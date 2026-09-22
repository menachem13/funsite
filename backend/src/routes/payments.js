const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { authenticate, requireRole } = require('../middleware/auth');
const { findCouponByCode, claimCoupon, applyDiscount, recordRedemption } = require('../services/coupons');
const { getStripeClient } = require('../services/stripeClient');

const ONE_TRIAL_PER_LISTING_CONSTRAINT = 'idx_payments_one_trial_per_listing';

const router = express.Router();

function sixMonthsFrom(date) {
  const end = new Date(date);
  end.setMonth(end.getMonth() + config.subscriptionMonths);
  return end;
}

function requireStripe() {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new ApiError(503, 'Payments are not configured on this server (set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET)');
  }
  return stripe;
}

/** A real Stripe Checkout Session for one listing-fee charge (used by both /checkout and /:id/complete-deferred below). */
async function createCheckoutSession(stripe, { amountCents, listingId, listingTitle, paymentId }) {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: { name: `Funall listing fee — ${listingTitle}` },
        },
        quantity: 1,
      },
    ],
    metadata: { paymentId: String(paymentId), listingId: String(listingId) },
    success_url: `${config.frontendUrl}/dashboard/${listingId}/edit?payment=success`,
    cancel_url: `${config.frontendUrl}/dashboard/${listingId}/edit?payment=cancelled`,
  });
}

/**
 * Optional `couponCode` in the body: percent/fixed coupons discount
 * `amount_cents` on this same payment. A views_gate coupon works
 * differently — instead of a discount, it activates the listing on a free
 * trial right now and defers the charge until the listing's view_count
 * reaches the coupon's view_threshold (see /payments/:id/complete-deferred)
 * — no Stripe session is created at grant time since no money moves yet.
 * Every other case creates a real Stripe Checkout Session and returns its
 * hosted URL; the frontend redirects the browser there. Stripe itself is
 * the only thing that can ever mark a payment paid, via the signature-
 * verified webhook below.
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
    }

    if (coupon && coupon.type === 'views_gate') {
      const providerRef = `trial_${crypto.randomUUID()}`;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Re-checks usability AND increments times_used atomically, inside
        // this transaction — closes the race where two concurrent checkouts
        // could both pass a since-stale usage check on the same coupon.
        coupon = await claimCoupon(client, coupon.id);

        const periodEnd = sixMonthsFrom(new Date());
        let inserted;
        try {
          inserted = await client.query(
            `INSERT INTO payments (listing_id, owner_id, amount_cents, status, provider_ref, coupon_id, view_threshold)
             VALUES ($1, $2, $3, 'pending', $4, $5, $6)
             RETURNING *`,
            [listingId, req.user.id, config.listingFeeCents, providerRef, coupon.id, coupon.view_threshold]
          );
        } catch (err) {
          if (err.constraint === ONE_TRIAL_PER_LISTING_CONSTRAINT) {
            throw new ApiError(400, 'This listing has already used a views-gated trial');
          }
          throw err;
        }
        const payment = inserted.rows[0];

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

        await client.query('COMMIT');
        res.status(201).json({ payment, trialActivated: true });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      return;
    }

    // Real payment: needs Stripe configured. Checked before touching the
    // coupon/DB so a misconfigured server fails clearly instead of claiming
    // a coupon redemption for a checkout that can never complete.
    const stripe = requireStripe();

    const amountCents = coupon ? applyDiscount(coupon, config.listingFeeCents) : config.listingFeeCents;
    const client = await pool.connect();
    let payment;
    try {
      await client.query('BEGIN');
      if (coupon) {
        coupon = await claimCoupon(client, coupon.id);
      }
      const inserted = await client.query(
        `INSERT INTO payments (listing_id, owner_id, amount_cents, status, coupon_id)
         VALUES ($1, $2, $3, 'pending', $4)
         RETURNING *`,
        [listingId, req.user.id, amountCents, coupon ? coupon.id : null]
      );
      payment = inserted.rows[0];
      if (coupon) {
        await recordRedemption(client, { couponId: coupon.id, listingId, ownerId: req.user.id, paymentId: payment.id });
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Stripe call happens outside the DB transaction (no point holding a
    // pool connection open across the network round-trip). If this fails,
    // the payment row is left pending with no provider_ref — harmless; the
    // owner just retries checkout, same as an abandoned real Stripe session
    // would leave one unused.
    const session = await createCheckoutSession(stripe, {
      amountCents,
      listingId,
      listingTitle: listing.title,
      paymentId: payment.id,
    });
    await pool.query('UPDATE payments SET provider_ref = $1 WHERE id = $2', [session.id, payment.id]);

    res.status(201).json({ payment: { ...payment, provider_ref: session.id }, checkoutUrl: session.url });
  })
);

/**
 * Real Stripe webhook. Needs the raw request body (see app.js — this path
 * is exempted from the global express.json() so the body arrives as an
 * unparsed Buffer) to verify the `stripe-signature` header; anything that
 * doesn't verify is rejected outright rather than trusted.
 *
 * Acknowledges (200) events it doesn't act on or can't match to a payment,
 * rather than erroring — a non-2xx makes Stripe retry indefinitely, and
 * there's nothing a retry would fix for "this session doesn't map to a
 * payment we know about."
 */
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const stripe = requireStripe();

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripeWebhookSecret);
    } catch (err) {
      throw new ApiError(400, `Webhook signature verification failed: ${err.message}`);
    }

    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.expired') {
      return res.json({ received: true });
    }

    const session = event.data.object;
    const { rows: paymentRows } = await pool.query('SELECT * FROM payments WHERE provider_ref = $1', [session.id]);
    const payment = paymentRows[0];
    if (!payment || payment.status !== 'pending') {
      return res.json({ received: true });
    }

    if (event.type === 'checkout.session.expired') {
      await pool.query(`UPDATE payments SET status = 'failed' WHERE id = $1`, [payment.id]);
      return res.json({ received: true });
    }

    // checkout.session.completed
    if (payment.view_threshold !== null) {
      const { rows: listingRows } = await pool.query('SELECT view_count FROM listings WHERE id = $1', [
        payment.listing_id,
      ]);
      if (!listingRows[0] || listingRows[0].view_count < payment.view_threshold) {
        // Shouldn't happen — /:id/complete-deferred already checks this
        // before creating the session — but acknowledge rather than error,
        // since retrying can never satisfy a threshold that isn't met.
        return res.json({ received: true });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const periodStart = new Date();
      const periodEnd = sixMonthsFrom(periodStart);

      await client.query(
        `UPDATE payments SET status = 'paid', period_start = $1, period_end = $2 WHERE id = $3`,
        [periodStart, periodEnd, payment.id]
      );
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

    res.json({ received: true });
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
 * met — "charge the card now that it's earned it." Creates a real Stripe
 * Checkout Session for this payment's amount and returns its URL; the
 * frontend redirects the browser there. The webhook above marks it paid,
 * same as the ordinary checkout flow.
 */
router.post(
  '/:id/complete-deferred',
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
    if (payment.status !== 'pending') throw new ApiError(400, `Payment is already ${payment.status}`);
    if (payment.view_count < payment.view_threshold) {
      throw new ApiError(400, `Not enough views yet: ${payment.view_count}/${payment.view_threshold}`);
    }

    const stripe = requireStripe();
    const session = await createCheckoutSession(stripe, {
      amountCents: payment.amount_cents,
      listingId: payment.listing_id,
      listingTitle: payment.listing_title,
      paymentId: payment.id,
    });
    await pool.query('UPDATE payments SET provider_ref = $1 WHERE id = $2', [session.id, payment.id]);

    res.json({ checkoutUrl: session.url });
  })
);

module.exports = router;
