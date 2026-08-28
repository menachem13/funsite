const ApiError = require('../utils/ApiError');

/** Case-insensitive coupon lookup. Returns null if the code doesn't exist. */
async function findCouponByCode(client, code) {
  const { rows } = await client.query('SELECT * FROM coupons WHERE upper(code) = upper($1)', [code]);
  return rows[0] || null;
}

/**
 * Atomically checks usability AND increments times_used in one statement —
 * must be called with a transaction client, right before the redemption it
 * guards. A separate check-then-increment (the previous shape of this
 * function) leaves a window where two concurrent redemptions can both pass
 * the check before either increments, letting a single-use coupon be
 * redeemed twice. Returns the coupon's fresh row, or throws if it's
 * inactive or exhausted.
 */
async function claimCoupon(client, couponId) {
  const { rows } = await client.query(
    `UPDATE coupons SET times_used = times_used + 1
     WHERE id = $1 AND active = true AND (usage_limit IS NULL OR times_used < usage_limit)
     RETURNING *`,
    [couponId]
  );
  if (!rows[0]) {
    throw new ApiError(400, 'This coupon code is no longer available (inactive or fully redeemed)');
  }
  return rows[0];
}

/** percent/fixed only — computes the discounted charge, floored at 0. */
function applyDiscount(coupon, baseAmountCents) {
  if (coupon.type === 'percent') {
    return Math.max(0, Math.round(baseAmountCents * (1 - coupon.percent_off / 100)));
  }
  if (coupon.type === 'fixed') {
    return Math.max(0, baseAmountCents - coupon.amount_off_cents);
  }
  throw new ApiError(500, `applyDiscount called on a non-discount coupon type: ${coupon.type}`);
}

/** Audit-trail row only — usage counting happens in claimCoupon() above. */
async function recordRedemption(client, { couponId, listingId, ownerId, paymentId }) {
  await client.query(
    'INSERT INTO coupon_redemptions (coupon_id, listing_id, owner_id, payment_id) VALUES ($1, $2, $3, $4)',
    [couponId, listingId, ownerId, paymentId]
  );
}

module.exports = { findCouponByCode, claimCoupon, applyDiscount, recordRedemption };
