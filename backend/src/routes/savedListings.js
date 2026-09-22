const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const attachCovers = require('../utils/attachCovers');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// A personal shortlist is a renter (customer) action, same restriction as
// messaging an owner (see routes/listings.js's POST /:id/messages) — an
// owner or admin account has no use for it here.

// GET /saved-listings — the current user's saved listings, most-recently-
// saved first. Same owner_name + cover shape as the public listings
// endpoints, so the frontend renders them with the exact same ListingCard.
// Deliberately not filtered by status — a listing the owner has taken
// temporarily inactive should still show up here as "saved"; the listing
// detail page's own visibility check is what a non-owner actually hits if
// they follow through to it (see assertListingVisible in routes/listings.js).
router.get(
  '/',
  authenticate,
  requireRole('renter'),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT l.*, u.name AS owner_name, s.created_at AS saved_at
       FROM saved_listings s
       JOIN listings l ON l.id = s.listing_id
       LEFT JOIN users u ON u.id = l.owner_id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json({ listings: await attachCovers(rows) });
  })
);

// POST /saved-listings { listingId } — idempotent: re-saving an
// already-saved listing just confirms it's saved rather than erroring, via
// the same unique constraint that also makes a duplicate impossible.
router.post(
  '/',
  authenticate,
  requireRole('renter'),
  asyncHandler(async (req, res) => {
    const listingId = parseInt(req.body?.listingId, 10);
    if (!listingId) throw new ApiError(400, 'listingId is required');

    const { rows } = await pool.query('SELECT id FROM listings WHERE id = $1', [listingId]);
    if (!rows[0]) throw new ApiError(404, 'Listing not found');

    await pool.query(
      `INSERT INTO saved_listings (user_id, listing_id) VALUES ($1, $2)
       ON CONFLICT (user_id, listing_id) DO NOTHING`,
      [req.user.id, listingId]
    );

    res.status(201).json({ saved: true });
  })
);

// DELETE /saved-listings/:listingId — un-save. Scoped by user_id in the
// WHERE clause (not just listing_id), so this can only ever remove the
// caller's own save, never another user's — deleting a listing_id that
// isn't actually saved by this user is simply a no-op, not an error.
router.delete(
  '/:listingId',
  authenticate,
  requireRole('renter'),
  asyncHandler(async (req, res) => {
    const listingId = parseInt(req.params.listingId, 10);
    await pool.query('DELETE FROM saved_listings WHERE user_id = $1 AND listing_id = $2', [req.user.id, listingId]);
    res.json({ saved: false });
  })
);

module.exports = router;
