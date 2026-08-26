const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /owner/dashboard — all of the current owner's listings + totals in one call
router.get(
  '/dashboard',
  authenticate,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const { rows: listings } = await pool.query(
      `SELECT
         l.*,
         COALESCE(msg.count, 0)::int AS message_count,
         COALESCE(unread.count, 0)::int AS unread_message_count,
         COALESCE(views14.data, '[]'::json) AS daily_views
       FROM listings l
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS count FROM messages m
         JOIN threads t ON t.id = m.thread_id
         WHERE t.listing_id = l.id
       ) msg ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS count FROM messages m
         JOIN threads t ON t.id = m.thread_id
         WHERE t.listing_id = l.id AND m.sender_id != l.owner_id AND m.read_at IS NULL
       ) unread ON true
       LEFT JOIN LATERAL (
         SELECT json_agg(row_to_json(d) ORDER BY d.day) AS data
         FROM (
           SELECT date_trunc('day', viewed_at)::date AS day, COUNT(*)::int AS views
           FROM listing_views
           WHERE listing_id = l.id AND viewed_at >= now() - interval '14 days'
           GROUP BY day
         ) d
       ) views14 ON true
       WHERE l.owner_id = $1
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );

    const totals = {
      totalViews: listings.reduce((sum, l) => sum + l.view_count, 0),
      activeListingCount: listings.filter((l) => l.status === 'active').length,
      unreadMessageCount: listings.reduce((sum, l) => sum + l.unread_message_count, 0),
      listingCount: listings.length,
    };

    res.json({ listings, totals });
  })
);

module.exports = router;
