const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { authenticate, requireRole } = require('../middleware/auth');
const { findCouponByCode, assertCouponUsable, applyDiscount, recordRedemption } = require('../services/coupons');

const router = express.Router();

function sixMonthsFrom(date) {
  const end = new Date(date);
  end.setMonth(end.getMonth() + config.subscriptionMonths);
  return end;
}

/**
 * Checkout and webhook are stubbed — they correctly create pending payments
 * and activate/expire listings, but don't call a real processor yet.
 * Stripe is the natural fit for a recurring $100/6-month charge (see spec
 * section 8.1): swap the body of this handler for a Stripe Checkout Session
 * and point STRIPE webhooks at POST /payments/webhook.
 *
 * Optional `couponCode` in the body: percent/fixed coupons discount
 * `amount_cents` on this same payment. A views_gate coupon works
 * differently — instead of a discount, it activates the listing on a free
 * trial right now and defers the charge until the listing's view_count
 * reaches the coupon's view_threshold (see /payments/:id/complete-deferred).
 */
router.post(
  '/listings/:id/checkout',
  authenticate,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const listingId = parseInt(req.params.id, 10);
    const { couponCode } = req.body || {};

    const { rows: listingRows } = await pool.query('SELECT * FROM listings WHERE id = $1', [listingId]);
    const listing = listingRows[0];
    if (!listing) throw new ApiError(404, 'Listing not found');
    if (listing.owner_id !== req.user.id) throw new ApiError(403, 'You do not own this listing');

    let coupon = null;
    if (couponCode) {
      coupon = await findCouponByCode(pool, couponCode);
      if (!coupon) throw new ApiError(400, 'Unknown coupon code');
      assertCouponUsable(coupon);
    }

    const providerRef = `stub_${crypto.randomUUID()}`;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let payment;
      if (coupon && coupon.type === 'views_gate') {
        // Free trial: activate now, defer the charge until the view threshold hits.
        const periodEnd = sixMonthsFrom(new Date());
        const inserted = await client.query(
          `INSERT INTO payments (listing_id, owner_id, amount_cents, status, provider_ref, coupon_id, view_threshold)
           VALUES ($1, $2, $3, 'pending', $4, $5, $6)
           RETURNING *`,
          [listingId, req.user.id, config.listingFeeCents, providerRef, coupon.id, coupon.view_threshold]
        );
        payment = inserted.rows[0];

        await client.query(
          `UPDATE listings SET status = 'active', subscription_expires_at = $1, updated_at = now() WHERE id = $2`,
          [periodEnd, listingId]
        );
        await recordRedemption(client, {
          couponId: coupon.id,
          listingId,
          ownerId: req.user.id,
          paymentId: payment.id,
        });
      } else {
        const amountCents = coupon ? applyDiscount(coupon, config.listingFeeCents) : config.listingFeeCents;
        const inserted = await client.query(
          `INSERT INTO payments (listing_id, owner_id, amount_cents, status, provider_ref, coupon_id)
           VALUES ($1, $2, $3, 'pending', $4, $5)
           RETURNING *`,
          [listingId, req.user.id, amountCents, providerRef, coupon ? coupon.id : null]
        );
        payment = inserted.rows[0];

        if (coupon) {
          await recordRedemption(client, {
            couponId: coupon.id,
            listingId,
            ownerId: req.user.id,
            paymentId: payment.id,
          });
        }
      }

      await client.query('COMMIT');

      const isTrial = coupon?.type === 'views_gate';
      res.status(201).json({
        payment,
        checkoutUrl: isTrial ? undefined : `stub://checkout/${providerRef}`,
        trialActivated: isTrial || undefined,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

/**
 * Provider calls this on payment success/failure. Expects
 * { providerRef, status: 'paid' | 'failed' } — matches the shape a real
 * processor's webhook payload would be normalized to before reaching here.
 */
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const { providerRef, status } = req.body || {};
    if (!providerRef || !['paid', 'failed'].includes(status)) {
      throw new ApiError(400, 'providerRef and status ("paid" or "failed") are required');
    }

    const { rows: paymentRows } = await pool.query('SELECT * FROM payments WHERE provider_ref = $1', [providerRef]);
    const payment = paymentRows[0];
    if (!payment) throw new ApiError(404, 'Unknown providerRef');

    if (payment.status !== 'pending') {
      return res.json({ payment });
    }

    if (payment.view_threshold !== null) {
      const { rows: listingRows } = await pool.query('SELECT view_count FROM listings WHERE id = $1', [
        payment.listing_id,
      ]);
      if (!listingRows[0] || listingRows[0].view_count < payment.view_threshold) {
        throw new ApiError(400, 'This payment is on a views-gated trial and is not chargeable yet');
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (status === 'paid') {
        const periodStart = new Date();
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + config.subscriptionMonths);

        await client.query(
          `UPDATE payments SET status = 'paid', period_start = $1, period_end = $2 WHERE id = $3`,
          [periodStart, periodEnd, payment.id]
        );
        await client.query(
          `UPDATE listings SET status = 'active', subscription_expires_at = $1, updated_at = now() WHERE id = $2`,
          [periodEnd, payment.listing_id]
        );
      } else {
        await client.query(`UPDATE payments SET status = 'failed' WHERE id = $1`, [payment.id]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const { rows: updated } = await pool.query('SELECT * FROM payments WHERE id = $1', [payment.id]);
    res.json({ payment: updated[0] });
  })
);

/**
 * Read-only progress check for a views_gate trial — how many views the
 * listing has toward the threshold that makes this payment chargeable.
 */
router.get(
  '/:id/deferred-status',
  authenticate,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const paymentId = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT p.*, l.view_count, l.title AS listing_title
       FROM payments p JOIN listings l ON l.id = p.listing_id
       WHERE p.id = $1`,
      [paymentId]
    );
    const payment = rows[0];
    if (!payment) throw new ApiError(404, 'Payment not found');
    if (payment.owner_id !== req.user.id) throw new ApiError(403, 'You do not own this payment');
    if (payment.view_threshold === null) throw new ApiError(400, 'This payment is not on a views-gated trial');

    res.json({
      status: payment.status,
      listingTitle: payment.listing_title,
      currentViews: payment.view_count,
      viewThreshold: payment.view_threshold,
      thresholdMet: payment.view_count >= payment.view_threshold,
    });
  })
);

/**
 * Owner-triggered completion of a views_gate trial once the threshold is
 * met — the stub equivalent of "charge the card now that it's earned it."
 */
router.post(
  '/:id/complete-deferred',
  authenticate,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const paymentId = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT p.*, l.view_count
       FROM payments p JOIN listings l ON l.id = p.listing_id
       WHERE p.id = $1`,
      [paymentId]
    );
    const payment = rows[0];
    if (!payment) throw new ApiError(404, 'Payment not found');
    if (payment.owner_id !== req.user.id) throw new ApiError(403, 'You do not own this payment');
    if (payment.view_threshold === null) throw new ApiError(400, 'This payment is not on a views-gated trial');
    if (payment.status !== 'pending') throw new ApiError(400, `Payment is already ${payment.status}`);
    if (payment.view_count < payment.view_threshold) {
      throw new ApiError(400, `Not enough views yet: ${payment.view_count}/${payment.view_threshold}`);
    }

    const periodStart = new Date();
    const periodEnd = sixMonthsFrom(periodStart);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE payments SET status = 'paid', period_start = $1, period_end = $2 WHERE id = $3`, [
        periodStart,
        periodEnd,
        payment.id,
      ]);
      await client.query(
        `UPDATE listings SET status = 'active', subscription_expires_at = $1, updated_at = now() WHERE id = $2`,
        [periodEnd, payment.listing_id]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const { rows: updated } = await pool.query('SELECT * FROM payments WHERE id = $1', [payment.id]);
    res.json({ payment: updated[0] });
  })
);

module.exports = router;
