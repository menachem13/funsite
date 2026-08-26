# Funsite

Two-sided marketplace: owners of bounce houses, photo booths, carousels, and
similar event attractions list them for a flat fee; renters browse, filter,
and message owners directly to book.

## Structure

```
backend/    Express + PostgreSQL API — see backend/README.md for setup
frontend/   Static marketing/waitlist landing page (index.html, css/, js/)
```

The logged-in owner dashboard and renter browsing UI are not part of this
static frontend — those need a real frontend app (React or similar) talking
to the API in `backend/`, per the product spec.

## Quick start

```bash
# Backend
cd backend
npm install
cp .env.example .env   # set DATABASE_URL, JWT_SECRET
npm run migrate
npm start                # http://localhost:4000

# Frontend (any static server)
cd frontend
python3 -m http.server 8080   # http://localhost:8080
```

## Deployment

- **Backend:** Render (Node web service + managed Postgres), env vars
  `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV`.
- **Frontend:** Vercel or Netlify (static hosting, auto-deploy from GitHub).

## What's stubbed / not yet built

See `backend/README.md` for backend-specific notes. Not built at all yet:
real payment processing (Stripe), cloud file storage, structured/geocoded
location, the logged-in owner/renter frontend app, notifications, password
reset, admin tooling, and rate limiting — tracked in the product spec.
