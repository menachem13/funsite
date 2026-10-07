const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { parsePagination, buildPageMeta } = require('../utils/pagination');
const { COMPLETENESS_TOTAL, COMPLETENESS_DONE_SQL, MEDIA_COUNT_LATERAL_JOIN } = require('../utils/listingCompleteness');

const router = express.Router();

// GET /owner/dashboard — paginated listing rows for the table, plus totals
// computed across ALL of the owner's listings (not just the current page) —
// the stat tiles and the "getting started" nudge both need the whole
// picture, so those are separate lightweight aggregate queries rather than
// being derived from whatever one page of rows happens to be in memory.
router.get(
  '/dashboard',
  authenticate,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePagination(req.query);

    const [totalsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS listing_count,
           COALESCE(SUM(l.view_count), 0)::int AS total_views,
           COUNT(*) FILTER (WHERE l.status = 'active')::int AS active_listing_count,
           COALESCE(SUM(unread.count), 0)::int AS unread_message_count,
           COALESCE(SUM(msg.count), 0)::int AS total_message_count
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
         WHERE l.owner_id = $1`,
        [req.user.id]
      ),
      pool.query('SELECT COUNT(*)::int AS count FROM listings WHERE owner_id = $1', [req.user.id]),
    ]);

    const t = totalsResult.rows[0];
    const meta = buildPageMeta({ page, pageSize, totalItems: countResult.rows[0].count });

    // Same listing picked by the pre-pagination frontend logic this
    // replaces: the most recently created listing that isn't 100% complete
    // yet, independent of which page it would land on.
    const incompleteResult = await pool.query(
      `SELECT l.id, l.title
       FROM listings l
       ${MEDIA_COUNT_LATERAL_JOIN}
       WHERE l.owner_id = $1 AND ${COMPLETENESS_DONE_SQL} < ${COMPLETENESS_TOTAL}
       ORDER BY l.created_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    const { rows: listings } = await pool.query(
      `SELECT
         l.*,
         COALESCE(msg.count, 0)::int AS message_count,
         COALESCE(unread.count, 0)::int AS unread_message_count,
         COALESCE(media.count, 0)::int AS media_count,
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
         SELECT COUNT(*) AS count FROM listing_media WHERE listing_id = l.id
       ) media ON true
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
       ORDER BY l.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, meta.pageSize, meta.offset]
    );

    const totals = {
      totalViews: t.total_views,
      activeListingCount: t.active_listing_count,
      unreadMessageCount: t.unread_message_count,
      listingCount: t.listing_count,
      totalActivity: t.total_views + t.total_message_count,
      incompleteListing: incompleteResult.rows[0] || null,
    };

    res.json({ listings, totals, pagination: meta });
  })
);

module.exports = router;
