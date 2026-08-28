# Funsite API

Node.js + Express + PostgreSQL backend for Funsite. See `/spec` (or the
product spec you were handed) for the full design; this covers setup only.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, FRONTEND_URL
npm run migrate         # creates all tables (idempotent — CREATE TABLE IF NOT EXISTS)
npm start                # or `npm run dev` for auto-restart on change
```

The server listens on `PORT` (default `4000`) and mounts the API under `/api`.
A nightly cron job (`src/jobs/cron.js`, 02:00 server time) expires lapsed
subscriptions and runs the featured-listing rotation.

## Project layout

```
src/
  app.js            Express app: CORS, route mounting, error handling
  server.js         Entry point — starts the HTTP server + cron
  config.js         Env var loading/validation
  db/
    schema.sql      Full table definitions
    migrate.js       Runs schema.sql against DATABASE_URL
    pool.js          pg Pool
  middleware/
    auth.js          JWT verification, role guard
    upload.js         Multer config (local disk — see note below)
    errorHandler.js
  routes/
    auth.js, listings.js, threads.js, payments.js, dashboard.js, admin.js
  services/
    featuredRotation.js    Isolated, swappable "who's featured today" logic
    subscriptionExpiry.js
    coupons.js              Lookup, usage-limit check, discount math
  jobs/
    cron.js
```

## Coupons

Three mutually exclusive types, admin-created only (`POST /admin/coupons`,
`role: admin`):

- **`percent`** — `percentOff` (1–100) knocked off the fee at checkout.
- **`fixed`** — `amountOffCents` knocked off the fee at checkout.
- **`views_gate`** — not a discount. Redeeming one at checkout activates the
  listing immediately on a free trial (`subscription_expires_at` set 6
  months out, no charge yet) and defers the charge until the listing's
  `view_count` reaches `viewThreshold`. Meant for pitching a skeptical new
  owner: "you don't pay until the listing's actually gotten N views." Once
  the threshold is hit, `POST /payments/:id/complete-deferred` collects the
  (stubbed) charge; `GET /payments/:id/deferred-status` reports progress
  toward it in the meantime. If the threshold is never reached, the trial
  just lapses at the normal 6-month expiry via the nightly cron — no special
  handling needed there.

Every coupon has an optional `usageLimit` (omit for unlimited redemptions;
`1` for single-use; any N for "good for N redemptions total"), enforced
against `times_used` at redemption. `PATCH /admin/coupons/:id` toggles
`active` or adjusts `usageLimit` after the fact — it does not let you change
a coupon's discount type or amount once created, to keep past redemptions'
math meaningful. `DELETE /admin/coupons/:id` is a hard delete; past
`payments`/`coupon_redemptions` rows referencing it keep their history with
`coupon_id` set to `NULL` rather than being deleted or orphaned.

Redeem one by passing `couponCode` in the body of
`POST /payments/listings/:id/checkout`.

**There's no admin signup flow yet** (spec section 2 flags admin tooling as
unbuilt, and `POST /auth/register` only accepts `owner`/`renter` — allowing
public self-registration as admin would be a real vulnerability). To test or
bootstrap the first admin, register normally then promote by hand:
```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## Notes for whoever picks this up next

- **File uploads are local disk** (`uploads/`, served at `/uploads/...`).
  Most hosts wipe local disk on redeploy — move to S3/R2 before real launch.
- **Payments are stubbed.** `POST /payments/listings/:id/checkout` and
  `POST /payments/webhook` correctly create pending payments and
  activate/expire listings, but don't call a real processor. Swap in Stripe
  Checkout + webhook verification; keep the same activate-on-`paid` flow.
- **CORS** reads `FRONTEND_URL` — set it to the real frontend origin before
  launch (defaults to `*` if unset, which is fine for local dev only).
- **SSL to Postgres** turns on automatically when `NODE_ENV=production`
  (`db/pool.js`) — needed for managed providers like Supabase/Neon/Render.
  Local dev Postgres has no SSL listener, so keep `NODE_ENV=development` there.
- **Featured rotation** lives entirely in `services/featuredRotation.js` and
  is deliberately fairness-based (longest-since-featured), not popularity- or
  spend-based — see the product spec before changing this.
