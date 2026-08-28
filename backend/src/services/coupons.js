const ApiError = require('../utils/ApiError');

/** Case-insensitive coupon lookup. Returns null if the code doesn't exist. */
async function findCouponByCode(client, code) {
  const { rows } = await client.query('SELECT * FROM coupons WHERE upper(code) = upper($1)', [code]);
  return rows[0] || null;
}

/** Throws if the coupon can't be redeemed right now (inactive or exhausted). */
function assertCouponUsable(coupon) {
  if (!coupon.active) {
    throw new ApiError(400, 'This coupon code is no longer active');
  }
  if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) {
    throw new ApiError(400, 'This coupon code has already been fully redeemed');
  }
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

/** Records a redemption and increments the coupon's usage counter. */
async function recordRedemption(client, { couponId, listingId, ownerId, paymentId }) {
  await client.query(
    'INSERT INTO coupon_redemptions (coupon_id, listing_id, owner_id, payment_id) VALUES ($1, $2, $3, $4)',
    [couponId, listingId, ownerId, paymentId]
  );
  await client.query('UPDATE coupons SET times_used = times_used + 1 WHERE id = $1', [couponId]);
}

module.exports = { findCouponByCode, assertCouponUsable, applyDiscount, recordRedemption };
