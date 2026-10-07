const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { authenticate, requireRole } = require('../middleware/auth');
const { parsePagination, buildPageMeta } = require('../utils/pagination');
const { COMPLETENESS_TOTAL, COMPLETENESS_DONE_SQL, MEDIA_COUNT_LATERAL_JOIN } = require('../utils/listingCompleteness');

const router = express.Router();
const COUPON_TYPES = ['percent', 'fixed', 'views_gate'];

// GET /admin/summary — real, current counts for the admin overview's stat
// tiles. Intentionally simple (no analytics system, no invented activity):
// just what's actually in the database right now. The "needs attention"
// list itself is its own paginated endpoint below, so loading the counts
// never has to also run (and re-run, on every page change) that query.
router.get(
  '/summary',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const [listingCounts, userCounts] = await Promise.all([
      pool.query(`SELECT status, COUNT(*)::int AS count FROM listings GROUP BY status`),
      pool.query(`SELECT role, COUNT(*)::int AS count FROM users GROUP BY role`),
    ]);

    const byStatus = Object.fromEntries(listingCounts.rows.map((r) => [r.status, r.count]));
    const byRole = Object.fromEntries(userCounts.rows.map((r) => [r.role, r.count]));

    res.json({
      listings: {
        total: listingCounts.rows.reduce((sum, r) => sum + r.count, 0),
        active: byStatus.active || 0,
        inactive: byStatus.inactive || 0,
        expired: byStatus.expired || 0,
      },
      users: {
        total: userCounts.rows.reduce((sum, r) => sum + r.count, 0),
        owners: byRole.owner || 0,
        renters: byRole.renter || 0,
      },
    });
  })
);

// GET /admin/attention — paginated active-but-incomplete listings.
// Ordered oldest-first: a listing that's been live and incomplete the
// longest is the most overdue for a nudge, so it surfaces first rather than
// whatever was most recently created.
router.get(
  '/attention',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePagination(req.query);

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM listings l
       ${MEDIA_COUNT_LATERAL_JOIN}
       WHERE l.status = 'active' AND ${COMPLETENESS_DONE_SQL} < ${COMPLETENESS_TOTAL}`
    );
    const meta = buildPageMeta({ page, pageSize, totalItems: countResult.rows[0].count });

    const { rows } = await pool.query(
      `SELECT l.id, l.title, l.status, u.name AS owner_name, l.created_at,
              ${COMPLETENESS_DONE_SQL} AS done
       FROM listings l
       JOIN users u ON u.id = l.owner_id
       ${MEDIA_COUNT_LATERAL_JOIN}
       WHERE l.status = 'active' AND ${COMPLETENESS_DONE_SQL} < ${COMPLETENESS_TOTAL}
       ORDER BY l.created_at ASC
       LIMIT $1 OFFSET $2`,
      [meta.pageSize, meta.offset]
    );

    res.json({
      items: rows.map((l) => ({
        id: l.id,
        title: l.title,
        status: l.status,
        ownerName: l.owner_name,
        completeness: { done: l.done, total: COMPLETENESS_TOTAL },
      })),
      pagination: meta,
    });
  })
);

function validateCouponFields({ type, percentOff, amountOffCents, viewThreshold }) {
  if (!COUPON_TYPES.includes(type)) {
    throw new ApiError(400, `type must be one of: ${COUPON_TYPES.join(', ')}`);
  }
  if (type === 'percent') {
    if (!Number.isInteger(percentOff) || percentOff <= 0 || percentOff > 100) {
      throw new ApiError(400, 'percentOff must be an integer between 1 and 100');
    }
  } else if (type === 'fixed') {
    if (!Number.isInteger(amountOffCents) || amountOffCents <= 0) {
      throw new ApiError(400, 'amountOffCents must be a positive integer');
    }
  } else if (type === 'views_gate') {
    if (!Number.isInteger(viewThreshold) || viewThreshold <= 0) {
      throw new ApiError(400, 'viewThreshold must be a positive integer');
    }
  }
}

// POST /admin/coupons — create a coupon (admin only)
router.post(
  '/coupons',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { code, type, percentOff, amountOffCents, viewThreshold, usageLimit } = req.body || {};

    if (!code || !code.trim()) {
      throw new ApiError(400, 'code is required');
    }
    const normalizedCode = code.trim().toUpperCase();
    validateCouponFields({ type, percentOff, amountOffCents, viewThreshold });
    if (usageLimit !== undefined && usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) {
      throw new ApiError(400, 'usageLimit must be a positive integer, or omitted for unlimited use');
    }

    // Compare against the same normalized form that gets stored below —
    // otherwise a code that only differs by whitespace (e.g. " ABC" vs
    // stored "ABC") slips past this check and hits the DB's unique index
    // instead, surfacing as an unhandled 500 rather than this 409.
    const existing = await pool.query('SELECT id FROM coupons WHERE upper(code) = $1', [normalizedCode]);
    if (existing.rows.length > 0) {
      throw new ApiError(409, 'A coupon with this code already exists');
    }

    const { rows } = await pool.query(
      `INSERT INTO coupons (code, type, percent_off, amount_off_cents, view_threshold, usage_limit, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        normalizedCode,
        type,
        type === 'percent' ? percentOff : null,
        type === 'fixed' ? amountOffCents : null,
        type === 'views_gate' ? viewThreshold : null,
        usageLimit ?? null,
        req.user.id,
      ]
    );

    res.status(201).json({ coupon: rows[0] });
  })
);

// GET /admin/coupons — list all coupons with redemption counts
router.get(
  '/coupons',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json({ coupons: rows });
  })
);

// PATCH /admin/coupons/:id — toggle active / adjust usage limit (not the discount itself)
router.patch(
  '/coupons/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const couponId = parseInt(req.params.id, 10);
    const { active, usageLimit } = req.body || {};

    if (active === undefined && usageLimit === undefined) {
      throw new ApiError(400, 'Provide at least one of: active, usageLimit');
    }
    if (usageLimit !== undefined && usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit <= 0)) {
      throw new ApiError(400, 'usageLimit must be a positive integer, or null for unlimited use');
    }

    const { rows } = await pool.query(
      `UPDATE coupons SET
         active = COALESCE($1, active),
         usage_limit = CASE WHEN $2 THEN $3 ELSE usage_limit END
       WHERE id = $4
       RETURNING *`,
      [active ?? null, usageLimit !== undefined, usageLimit ?? null, couponId]
    );

    if (!rows[0]) throw new ApiError(404, 'Coupon not found');
    res.json({ coupon: rows[0] });
  })
);

// DELETE /admin/coupons/:id — remove a coupon (past redemptions/payments keep their history via ON DELETE SET NULL)
router.delete(
  '/coupons/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const couponId = parseInt(req.params.id, 10);
    const { rowCount } = await pool.query('DELETE FROM coupons WHERE id = $1', [couponId]);
    if (rowCount === 0) throw new ApiError(404, 'Coupon not found');
    res.status(204).send();
  })
);

module.exports = router;
