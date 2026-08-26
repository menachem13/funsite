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
cp .env.example .env   # set DATABASE_URL (your own Postgres locally), JWT_SECRET
npm run migrate
npm start                # http://localhost:4000

# Frontend (any static server)
cd frontend
python3 -m http.server 8080   # http://localhost:8080
```

## Deployment

Config files for both halves are already in the repo — connect your own
Render/Netlify accounts and each should deploy with little to no manual setup.

### Database → Supabase

Render does host managed Postgres, but its free plan is **deleted after 30
days** — so the database lives on Supabase instead, whose free Postgres just
pauses (not deletes) after 7 days of no traffic, and un-pauses itself on the
next request or with one click in the dashboard.

1. [New project](https://supabase.com/dashboard) → pick a name/region/password.
2. Project Settings → Database → **Connect** → Connection string. Pick the
   **Session pooler** tab (not "Direct connection" and not "Transaction
   pooler") and copy that URI — this is your `DATABASE_URL`.

   ⚠️ Direct connection resolves to an **IPv6-only** address, and Render has
   no outbound IPv6 support — that combination will fail to connect
   (`ENETUNREACH`) with no obvious reason why. Session pooler runs over IPv4
   through Supabase's Supavisor pooler and gives this backend (a normal,
   persistent Express process — not a burst of short-lived serverless
   requests) a dedicated connection per client, including features like
   prepared statements that Transaction pooler mode restricts.

### Backend → Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/menachem13/funsite)

Or manually: New → Blueprint → point at this repo. `render.yaml` provisions
the Node web service and generates `JWT_SECRET` for you, but prompts you for
two values it can't know in advance:

- **`DATABASE_URL`** — the Supabase connection string from above.
- **`FRONTEND_URL`** — wherever the frontend below ends up (you can leave it
  blank for the first deploy and fill it in after, then redeploy).

The web service's start command runs the DB migration before every boot, so
the schema stays up to date automatically.

⚠️ Render's own **free web service spins down after 15 minutes idle** and
takes 30–60s to wake back up on the next request — expected on the free
tier, not a bug. A paid instance stays warm.

If you didn't use the button above (which needs the repo to be public), a
private repo needs the manual Blueprint path with a connected GitHub account
instead.

### Frontend → Netlify

New site from Git → pick this repo. `netlify.toml` (at the repo root) is
already configured with `base = "frontend"`, so Netlify serves
`frontend/index.html` with no build step and no extra settings needed.

**Vercel instead:** works too, just set the project's **Root Directory** to
`frontend` in the dashboard when importing (Vercel doesn't read that setting
from a config file the way Netlify does) — everything else is automatic.

### Wiring the two together

CORS is locked to `FRONTEND_URL`, so the API will reject browser requests
from any other origin. After both are deployed: copy the frontend's URL into
the backend's `FRONTEND_URL` env var (Render dashboard → redeploy), and if
you're calling the API from the frontend, point those requests at the
backend's `.onrender.com` URL (or your custom domain, once you attach one —
both platforms issue HTTPS certs for custom domains automatically).

## What's stubbed / not yet built

See `backend/README.md` for backend-specific notes. Not built at all yet:
real payment processing (Stripe), cloud file storage, structured/geocoded
location, the logged-in owner/renter frontend app, notifications, password
reset, admin tooling, and rate limiting — tracked in the product spec.
