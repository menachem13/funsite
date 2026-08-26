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
    auth.js, listings.js, threads.js, payments.js, dashboard.js
  services/
    featuredRotation.js    Isolated, swappable "who's featured today" logic
    subscriptionExpiry.js
  jobs/
    cron.js
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
- **Featured rotation** lives entirely in `services/featuredRotation.js` and
  is deliberately fairness-based (longest-since-featured), not popularity- or
  spend-based — see the product spec before changing this.
