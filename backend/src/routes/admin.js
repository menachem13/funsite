const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const COUPON_TYPES = ['percent', 'fixed', 'views_gate'];

// How many of the same six optional-but-valuable fields a listing has
// filled in — mirrors frontend/src/utils/listingCompleteness.js exactly
// (description, a photo/video, location, capacity, event types, age range).
// There's no shared module between the two separately-deployed frontend
// (ESM) and backend (CommonJS) packages, so this predicate is duplicated by
// hand; keep it in sync if listingCompleteness.js's checks ever change.
const COMPLETENESS_TOTAL = 6;
const COMPLETENESS_DONE_SQL = `(
  (CASE WHEN l.description IS NOT NULL AND trim(l.description) <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN COALESCE(media.count, 0) > 0 THEN 1 ELSE 0 END) +
  (CASE WHEN l.location IS NOT NULL AND trim(l.location) <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN l.capacity IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN l.event_types IS NOT NULL AND array_length(l.event_types, 1) > 0 THEN 1 ELSE 0 END) +
  (CASE WHEN l.audience_age_min IS NOT NULL OR l.audience_age_max IS NOT NULL THEN 1 ELSE 0 END)
)`;

// GET /admin/summary — real, current counts for the admin overview page.
// Intentionally simple (no analytics system, no invented activity): just
// what's actually in the database right now.
router.get(
  '/summary',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const [listingCounts, userCounts, attention] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*)::int AS count FROM listings GROUP BY status`
      ),
      pool.query(`SELECT role, COUNT(*)::int AS count FROM users GROUP BY role`),
      pool.query(
        `SELECT l.id, l.title, l.status, u.name AS owner_name, l.created_at,
                ${COMPLETENESS_DONE_SQL} AS done
         FROM listings l
         JOIN users u ON u.id = l.owner_id
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS count FROM listing_media WHERE listing_id = l.id
         ) media ON true
         WHERE l.status = 'active' AND ${COMPLETENESS_DONE_SQL} < ${COMPLETENESS_TOTAL}
         ORDER BY l.created_at DESC
         LIMIT 8`
      ),
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
      attentionListings: attention.rows.map((l) => ({
        id: l.id,
        title: l.title,
        status: l.status,
        ownerName: l.owner_name,
        completeness: { done: l.done, total: COMPLETENESS_TOTAL },
      })),
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
