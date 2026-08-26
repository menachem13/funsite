const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * Checkout and webhook are stubbed — they correctly create pending payments
 * and activate/expire listings, but don't call a real processor yet.
 * Stripe is the natural fit for a recurring $100/6-month charge (see spec
 * section 8.1): swap the body of this handler for a Stripe Checkout Session
 * and point STRIPE webhooks at POST /payments/webhook.
 */
router.post(
  '/listings/:id/checkout',
  authenticate,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const listingId = parseInt(req.params.id, 10);

    const { rows: listingRows } = await pool.query('SELECT * FROM listings WHERE id = $1', [listingId]);
    const listing = listingRows[0];
    if (!listing) throw new ApiError(404, 'Listing not found');
    if (listing.owner_id !== req.user.id) throw new ApiError(403, 'You do not own this listing');

    const providerRef = `stub_${crypto.randomUUID()}`;
    const { rows } = await pool.query(
      `INSERT INTO payments (listing_id, owner_id, amount_cents, status, provider_ref)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING *`,
      [listingId, req.user.id, config.listingFeeCents, providerRef]
    );

    res.status(201).json({
      payment: rows[0],
      checkoutUrl: `stub://checkout/${providerRef}`,
    });
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

module.exports = router;
