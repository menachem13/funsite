# Funall frontend

React (Vite, no TypeScript) single-page app — the actual product, talking to
the API in `../backend`. Not a marketing page with a separate app bolted on;
the marketing/landing content lives at `/` alongside everything else.

## Setup

```bash
npm install
cp .env.example .env   # VITE_API_URL — defaults to http://localhost:4000/api
npm run dev              # http://localhost:5173
```

`VITE_API_URL` is baked in at **build** time (Vite convention) — changing it
in production always needs a rebuild, not just a restart.

## Pages / routes

```
/                     Landing page
/login, /register     Renter or owner auth
/browse               Search & filter listings
/listings/:id         Listing detail — media gallery, message-the-owner form
/dashboard            Owner: listings table + view/message/featured stats
/dashboard/new         Owner: create a listing
/dashboard/:id/edit    Owner: edit listing, upload media, checkout/coupon
/inbox, /inbox/:id     Message threads (both renter and owner)
/admin/login           Admin: username + emailed OTP (no password)
/admin/coupons         Admin: create/manage coupon codes
```

## Structure

```
src/
  main.jsx, App.jsx      Router setup
  index.css                Design tokens + shared component styles (buttons,
                            cards, forms, badges, live-view indicator, etc.)
                            — global by nature of how Vite bundles CSS, so
                            page-specific styles live in each page's own
                            .css file rather than fighting that.
  api/client.js            Fetch wrapper: attaches the JWT, throws ApiError
                            with the backend's own message on failure
  context/AuthContext.jsx  Current user + JWT, persisted in localStorage
                            (no GET /auth/me on the backend yet, so the user
                            object from login/register/verify-otp is what
                            persists across a refresh)
  components/              Navbar, Footer, LogoMark, ListingCard,
                            ProtectedRoute (role-gated routes)
  pages/                   One file (plus a same-name .css) per route above
```

## Notes for whoever picks this up next

- **Payments are still the backend's stub**, not a real processor. The
  checkout panel on `/dashboard/:id/edit` calls it honestly: a normal
  purchase shows a "Complete demo payment" button that hits
  `POST /payments/webhook` directly (standing in for what a real payment
  provider's server-to-server callback would do); a `views_gate` coupon
  shows trial progress and a "Complete payment now" button once the view
  threshold is met. Swap in a real Stripe Checkout redirect here once the
  backend is wired to one — see `backend/README.md`.
- **Editing your own listing bumps its own view count.** `GET /listings/:id`
  is the only way to fetch one listing's full detail (including media), and
  the backend logs a view on every call, owner included. Harmless in
  practice, just don't be surprised the number moves when you're the one
  looking.
- **Pending-payment tracking is client-side only.** There's no backend
  endpoint to list a listing's payments, so which payment is currently
  awaiting completion is tracked in `localStorage` (`funsite_payment_<id>`)
  rather than re-derived from the server. Clearing site data loses that
  pointer (the payment row itself is unaffected — just re-checkout to
  create a fresh one, or complete it via the backend directly).
