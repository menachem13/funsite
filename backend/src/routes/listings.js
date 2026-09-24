const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const attachCovers = require('../utils/attachCovers');
const { authenticate, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { saveListingMedia, mediaTypeFor } = require('../services/storage');

const router = express.Router();

// Structured location (city + state) is what's actually stored and filtered
// on; `location` stays a plain "City, State" display string derived from
// them, so every existing reader of listing.location (cards, detail page,
// the discovery-context contact-message flow) keeps working unchanged.
function combineLocation(city, state) {
  const parts = [city, state].map((p) => (p || '').trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

async function loadOwnedListing(listingId, ownerId) {
  const { rows } = await pool.query('SELECT * FROM listings WHERE id = $1', [listingId]);
  const listing = rows[0];
  if (!listing) throw new ApiError(404, 'Listing not found');
  if (listing.owner_id !== ownerId) throw new ApiError(403, 'You do not own this listing');
  return listing;
}

/** Best-effort JWT decode for routes that work for both logged-in and anonymous callers. */
function getOptionalViewer(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret);
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

/**
 * A listing that isn't 'active' yet (unpaid, or expired) hasn't been
 * published — only its owner (or an admin) should be able to see or
 * message about it. Everyone else gets the same 404 a nonexistent id
 * would, so guessing sequential ids can't be used to confirm a draft
 * listing exists.
 */
function assertListingVisible(listing, viewer) {
  if (listing.status === 'active') return;
  if (viewer && (viewer.id === listing.owner_id || viewer.role === 'admin')) return;
  throw new ApiError(404, 'Listing not found');
}

// --- Create -----------------------------------------------------------

router.post(
  '/',
  authenticate,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      category,
      locationCity,
      locationState,
      audienceAgeMin,
      audienceAgeMax,
      audienceGender,
      attendantRequired,
      capacity,
      eventTypes,
    } = req.body || {};

    if (!title || !category) {
      throw new ApiError(400, 'title and category are required');
    }

    const { rows } = await pool.query(
      `INSERT INTO listings
         (owner_id, title, description, category, location, location_city, location_state,
          audience_age_min, audience_age_max, audience_gender, attendant_required,
          capacity, event_types, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'all'), COALESCE($11, false), $12, $13, 'inactive')
       RETURNING *`,
      [
        req.user.id,
        title,
        description || null,
        category,
        combineLocation(locationCity, locationState),
        locationCity?.trim() || null,
        locationState?.trim() || null,
        audienceAgeMin ?? null,
        audienceAgeMax ?? null,
        audienceGender || null,
        attendantRequired ?? null,
        capacity ?? null,
        Array.isArray(eventTypes) && eventTypes.length > 0 ? eventTypes : null,
      ]
    );

    res.status(201).json({ listing: rows[0] });
  })
);

// --- Browse / search ----------------------------------------------------

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, location, city, state, minAge, maxAge, gender, attendantRequired, q, eventType, groupSize, sort } =
      req.query;

    const conditions = [`status = 'active'`];
    const params = [];

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    // Structured city/state filters match the new columns, but also fall
    // back to the legacy combined `location` text — so a listing that
    // predates this feature (location_city/state still NULL) stays
    // findable exactly as it was before.
    if (city) {
      params.push(`%${city}%`);
      conditions.push(`(location_city ILIKE $${params.length} OR location ILIKE $${params.length})`);
    }
    if (state) {
      params.push(`%${state}%`);
      conditions.push(`(location_state ILIKE $${params.length} OR location ILIKE $${params.length})`);
    }
    // Legacy single-field ?location= param (old bookmarked links, and the
    // homepage's own simple "Where?" box) — broad match across all three
    // location fields, matching its original substring-anywhere behavior.
    if (location) {
      params.push(`%${location}%`);
      conditions.push(
        `(location_city ILIKE $${params.length} OR location_state ILIKE $${params.length} OR location ILIKE $${params.length})`
      );
    }
    if (minAge) {
      params.push(parseInt(minAge, 10));
      conditions.push(`(audience_age_max IS NULL OR audience_age_max >= $${params.length})`);
    }
    if (maxAge) {
      params.push(parseInt(maxAge, 10));
      conditions.push(`(audience_age_min IS NULL OR audience_age_min <= $${params.length})`);
    }
    if (gender) {
      params.push(gender);
      conditions.push(`(audience_gender = 'all' OR audience_gender = $${params.length})`);
    }
    if (attendantRequired !== undefined) {
      params.push(attendantRequired === 'true');
      conditions.push(`attendant_required = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`);
    }
    if (eventType) {
      params.push(eventType);
      conditions.push(`event_types @> ARRAY[$${params.length}]::text[]`);
    }
    if (groupSize) {
      // A listing only counts as fitting a requested group size if the owner
      // actually specified a capacity that covers it — an unset capacity is
      // never assumed to fit, per "never invent capacity" in the product spec.
      params.push(parseInt(groupSize, 10));
      conditions.push(`capacity >= $${params.length}`);
    }

    // Whitelisted, not interpolated from the raw query param — an ORDER BY
    // built from unchecked user input is a SQL injection vector even though
    // this endpoint takes no other free-form SQL fragments.
    const SORTS = {
      newest: 'l.created_at DESC',
      popular: 'l.view_count DESC, l.created_at DESC',
      az: 'l.title ASC',
      // NULLS LAST: a listing with no capacity set isn't assumed to fit any
      // group size elsewhere in this file, so it shouldn't float to the top
      // of a capacity-sorted list either — it sorts after every listing
      // that actually specified one.
      capacity: 'l.capacity DESC NULLS LAST, l.created_at DESC',
    };
    const orderBy = SORTS[sort] || SORTS.newest;

    // LEFT JOIN (not INNER): a listing should never vanish from search
    // results just because something is off with its owner row. owner_id is
    // NOT NULL + FK, so `u` is missing in practice only if that invariant is
    // ever violated — owner_name simply comes back null then, same as any
    // other optional field, rather than the listing silently disappearing.
    const { rows } = await pool.query(
      `SELECT l.*, u.name AS owner_name
       FROM listings l
       LEFT JOIN users u ON u.id = l.owner_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}`,
      params
    );

    res.json({ listings: await attachCovers(rows) });
  })
);

// --- Featured -----------------------------------------------------------

router.get(
  '/featured',
  asyncHandler(async (req, res) => {
    const { getFeaturedListingId } = require('../services/featuredRotation');
    const listingId = await getFeaturedListingId();
    if (!listingId) return res.json({ listing: null });

    const { rows } = await pool.query(
      `SELECT l.*, u.name AS owner_name FROM listings l LEFT JOIN users u ON u.id = l.owner_id WHERE l.id = $1`,
      [listingId]
    );
    const [listing] = rows.length ? await attachCovers(rows) : [null];
    res.json({ listing });
  })
);

// --- Read one (+ view logging) ------------------------------------------

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const listingId = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT l.*, u.name AS owner_name FROM listings l LEFT JOIN users u ON u.id = l.owner_id WHERE l.id = $1`,
      [listingId]
    );
    const listing = rows[0];
    if (!listing) throw new ApiError(404, 'Listing not found');

    const viewer = getOptionalViewer(req);
    assertListingVisible(listing, viewer);

    const media = await pool.query(
      'SELECT * FROM listing_media WHERE listing_id = $1 ORDER BY position ASC, id ASC',
      [listingId]
    );

    await pool.query('INSERT INTO listing_views (listing_id, viewer_id) VALUES ($1, $2)', [
      listingId,
      viewer?.id ?? null,
    ]);
    await pool.query('UPDATE listings SET view_count = view_count + 1 WHERE id = $1', [listingId]);

    res.json({ listing: { ...listing, view_count: listing.view_count + 1 }, media: media.rows });
  })
);

// --- Update / Delete (owner, must own) -----------------------------------

router.put(
  '/:id',
  authenticate,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const listingId = parseInt(req.params.id, 10);
    const existing = await loadOwnedListing(listingId, req.user.id);

    const {
      title,
      description,
      category,
      locationCity,
      locationState,
      audienceAgeMin,
      audienceAgeMax,
      audienceGender,
      attendantRequired,
      capacity,
      eventTypes,
    } = req.body || {};

    // Resolve city/state first, falling back to the listing's current values
    // for whichever half wasn't included in this request — a save that
    // doesn't touch location (or the frontend's owner-editing-title-only
    // case) can never blank out an existing value. `location` is then
    // recomputed from the resolved pair, same as on create.
    const effectiveCity = locationCity !== undefined ? locationCity?.trim() || null : existing.location_city;
    const effectiveState = locationState !== undefined ? locationState?.trim() || null : existing.location_state;
    const nextLocation = combineLocation(effectiveCity, effectiveState);

    const { rows } = await pool.query(
      `UPDATE listings SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         location = $4,
         location_city = $5,
         location_state = $6,
         audience_age_min = COALESCE($7, audience_age_min),
         audience_age_max = COALESCE($8, audience_age_max),
         audience_gender = COALESCE($9, audience_gender),
         attendant_required = COALESCE($10, attendant_required),
         capacity = COALESCE($11, capacity),
         event_types = COALESCE($12, event_types),
         updated_at = now()
       WHERE id = $13
       RETURNING *`,
      [
        title ?? null,
        description ?? null,
        category ?? null,
        nextLocation,
        effectiveCity,
        effectiveState,
        audienceAgeMin ?? null,
        audienceAgeMax ?? null,
        audienceGender ?? null,
        attendantRequired ?? null,
        capacity ?? null,
        Array.isArray(eventTypes) && eventTypes.length > 0 ? eventTypes : null,
        listingId,
      ]
    );

    res.json({ listing: rows[0] });
  })
);

router.delete(
  '/:id',
  authenticate,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const listingId = parseInt(req.params.id, 10);
    await loadOwnedListing(listingId, req.user.id);
    await pool.query('DELETE FROM listings WHERE id = $1', [listingId]);
    res.status(204).send();
  })
);

// --- Media upload (owner, must own) --------------------------------------

router.post(
  '/:id/media',
  authenticate,
  requireRole('owner'),
  upload.array('files'),
  asyncHandler(async (req, res) => {
    const listingId = parseInt(req.params.id, 10);
    await loadOwnedListing(listingId, req.user.id);

    if (!req.files || req.files.length === 0) {
      throw new ApiError(400, 'No files uploaded (expected multipart field "files")');
    }

    const existing = await pool.query(
      'SELECT COALESCE(MAX(position), -1) AS max_position FROM listing_media WHERE listing_id = $1',
      [listingId]
    );
    let position = existing.rows[0].max_position + 1;

    const inserted = [];
    for (const file of req.files) {
      const type = mediaTypeFor(file.mimetype);
      const url = await saveListingMedia({ listingId, buffer: file.buffer, mimetype: file.mimetype });
      const { rows } = await pool.query(
        `INSERT INTO listing_media (listing_id, type, url, position) VALUES ($1, $2, $3, $4) RETURNING *`,
        [listingId, type, url, position]
      );
      inserted.push(rows[0]);
      position += 1;
    }

    res.status(201).json({ media: inserted });
  })
);

// --- Analytics (owner, must own) ------------------------------------------

router.get(
  '/:id/analytics',
  authenticate,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const listingId = parseInt(req.params.id, 10);
    const listing = await loadOwnedListing(listingId, req.user.id);

    const dailyViews = await pool.query(
      `SELECT date_trunc('day', viewed_at)::date AS day, COUNT(*)::int AS views
       FROM listing_views
       WHERE listing_id = $1 AND viewed_at >= now() - interval '14 days'
       GROUP BY day
       ORDER BY day ASC`,
      [listingId]
    );

    const messageCount = await pool.query(
      `SELECT COUNT(*)::int AS count FROM messages m
       JOIN threads t ON t.id = m.thread_id
       WHERE t.listing_id = $1`,
      [listingId]
    );

    res.json({
      listing: {
        id: listing.id,
        title: listing.title,
        viewCount: listing.view_count,
        featuredCount: listing.featured_count,
        lastFeaturedAt: listing.last_featured_at,
      },
      dailyViews: dailyViews.rows,
      messageCount: messageCount.rows[0].count,
    });
  })
);

// --- Start/continue a message thread (renter) -----------------------------

router.post(
  '/:id/messages',
  authenticate,
  requireRole('renter'),
  asyncHandler(async (req, res) => {
    const listingId = parseInt(req.params.id, 10);
    const { body } = req.body || {};
    if (!body || !body.trim()) {
      throw new ApiError(400, 'body is required');
    }

    const { rows: listingRows } = await pool.query('SELECT * FROM listings WHERE id = $1', [listingId]);
    const listing = listingRows[0];
    // Same 404 for "doesn't exist" and "isn't published yet" — a renter has
    // no legitimate reason to message about a listing that was never
    // activated, and this avoids confirming a draft listing's id is in use.
    if (!listing || listing.status !== 'active') throw new ApiError(404, 'Listing not found');

    let thread;
    const existing = await pool.query('SELECT * FROM threads WHERE listing_id = $1 AND renter_id = $2', [
      listingId,
      req.user.id,
    ]);
    if (existing.rows.length > 0) {
      thread = existing.rows[0];
    } else {
      const created = await pool.query(
        'INSERT INTO threads (listing_id, owner_id, renter_id) VALUES ($1, $2, $3) RETURNING *',
        [listingId, listing.owner_id, req.user.id]
      );
      thread = created.rows[0];
    }

    const { rows: messageRows } = await pool.query(
      'INSERT INTO messages (thread_id, sender_id, body) VALUES ($1, $2, $3) RETURNING *',
      [thread.id, req.user.id, body.trim()]
    );

    res.status(201).json({ thread, message: messageRows[0] });
  })
);

module.exports = router;
