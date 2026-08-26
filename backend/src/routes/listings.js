const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { authenticate, requireRole } = require('../middleware/auth');
const { upload, mediaTypeFor } = require('../middleware/upload');

const router = express.Router();

async function loadOwnedListing(listingId, ownerId) {
  const { rows } = await pool.query('SELECT * FROM listings WHERE id = $1', [listingId]);
  const listing = rows[0];
  if (!listing) throw new ApiError(404, 'Listing not found');
  if (listing.owner_id !== ownerId) throw new ApiError(403, 'You do not own this listing');
  return listing;
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
      location,
      audienceAgeMin,
      audienceAgeMax,
      audienceGender,
      attendantRequired,
    } = req.body || {};

    if (!title || !category) {
      throw new ApiError(400, 'title and category are required');
    }

    const { rows } = await pool.query(
      `INSERT INTO listings
         (owner_id, title, description, category, location,
          audience_age_min, audience_age_max, audience_gender, attendant_required, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'all'), COALESCE($9, false), 'inactive')
       RETURNING *`,
      [
        req.user.id,
        title,
        description || null,
        category,
        location || null,
        audienceAgeMin ?? null,
        audienceAgeMax ?? null,
        audienceGender || null,
        attendantRequired ?? null,
      ]
    );

    res.status(201).json({ listing: rows[0] });
  })
);

// --- Browse / search ----------------------------------------------------

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, location, minAge, maxAge, gender, attendantRequired, q } = req.query;

    const conditions = [`status = 'active'`];
    const params = [];

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (location) {
      params.push(`%${location}%`);
      conditions.push(`location ILIKE $${params.length}`);
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

    const { rows } = await pool.query(
      `SELECT * FROM listings WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params
    );

    res.json({ listings: rows });
  })
);

// --- Featured -----------------------------------------------------------

router.get(
  '/featured',
  asyncHandler(async (req, res) => {
    const { getFeaturedListingId } = require('../services/featuredRotation');
    const listingId = await getFeaturedListingId();
    if (!listingId) return res.json({ listing: null });

    const { rows } = await pool.query('SELECT * FROM listings WHERE id = $1', [listingId]);
    res.json({ listing: rows[0] || null });
  })
);

// --- Read one (+ view logging) ------------------------------------------

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const listingId = parseInt(req.params.id, 10);
    const { rows } = await pool.query('SELECT * FROM listings WHERE id = $1', [listingId]);
    const listing = rows[0];
    if (!listing) throw new ApiError(404, 'Listing not found');

    const media = await pool.query(
      'SELECT * FROM listing_media WHERE listing_id = $1 ORDER BY position ASC, id ASC',
      [listingId]
    );

    let viewerId = null;
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const config = require('../config');
        const payload = jwt.verify(header.slice(7), config.jwtSecret);
        viewerId = payload.sub;
      } catch {
        // Anonymous view is fine if the token is missing/invalid.
      }
    }

    await pool.query('INSERT INTO listing_views (listing_id, viewer_id) VALUES ($1, $2)', [listingId, viewerId]);
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
    await loadOwnedListing(listingId, req.user.id);

    const {
      title,
      description,
      category,
      location,
      audienceAgeMin,
      audienceAgeMax,
      audienceGender,
      attendantRequired,
    } = req.body || {};

    const { rows } = await pool.query(
      `UPDATE listings SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         location = COALESCE($4, location),
         audience_age_min = COALESCE($5, audience_age_min),
         audience_age_max = COALESCE($6, audience_age_max),
         audience_gender = COALESCE($7, audience_gender),
         attendant_required = COALESCE($8, attendant_required),
         updated_at = now()
       WHERE id = $9
       RETURNING *`,
      [
        title ?? null,
        description ?? null,
        category ?? null,
        location ?? null,
        audienceAgeMin ?? null,
        audienceAgeMax ?? null,
        audienceGender ?? null,
        attendantRequired ?? null,
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
      const url = `/uploads/${file.filename}`;
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
    if (!listing) throw new ApiError(404, 'Listing not found');

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
