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
    adminAuth.js             OTP generation/verification for admin login
    mailer.js                SMTP send if configured, console-log stub otherwise
  jobs/
    cron.js
```

## Admin login

Admin has no password. It's a single fixed identity, set via env vars —
there's no admin self-registration, and `POST /auth/register` only ever
accepts `owner`/`renter` (letting anyone self-register as admin would be a
real vulnerability):

- `ADMIN_USERNAME` — whatever you pick.
- `ADMIN_OTP_EMAILS` — comma-separated; the login code goes to all of them,
  any one recipient can complete the login.

Flow: `POST /auth/admin/request-otp { username }` emails a 6-digit code
(10-minute expiry, invalidates any still-open code, always responds the same
regardless of whether `username` was actually right — so this endpoint can't
be used to test the username). `POST /auth/admin/verify-otp { username, code }`
checks it (5 wrong tries and you need a new code) and returns a normal JWT
with `role: admin`, same as any other login. The underlying `users` row is
auto-created on first successful login (email = the first `ADMIN_OTP_EMAILS`
address, an unusable random `password_hash` since it's never used) — no
manual DB step needed. `POST /auth/login` (the password path) explicitly
rejects `role: admin` accounts, so there's exactly one way in.

Without `ADMIN_USERNAME`/`ADMIN_OTP_EMAILS` set, the `admin/*` auth routes
503 with a clear message — the rest of the app runs fine without an admin
configured. Without `SMTP_HOST` etc. set too, the OTP is only logged to the
server's own console/log output (`services/mailer.js`) rather than actually
emailed — fine for local dev, not for real access control once this is
public.

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
`POST /payments/listings/:id/checkout`. See "Admin login" above for how to
actually get a `role: admin` token to call these with.

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
