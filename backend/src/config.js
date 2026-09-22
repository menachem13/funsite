require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Required only outside local development. Render's local disk is wiped on
// every redeploy, so in production listing photos/videos MUST go to
// Supabase Storage — falling back to disk there would silently reintroduce
// the exact "photos disappear on redeploy" bug this is meant to fix. Local
// dev without a Supabase Storage bucket configured still works, writing to
// ./uploads instead (see services/storage.js).
function requiredInProduction(name) {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${name} (required in production — see .env.example)`);
  }
  return value || null;
}

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  frontendUrl: process.env.FRONTEND_URL || '*',
  listingFeeCents: 10000,
  subscriptionMonths: 6,

  // Admin login is username + emailed OTP, not password (see routes/auth.js
  // and services/adminAuth.js) — deliberately not required() at boot, since
  // an admin-less deployment should still run. The admin/* auth routes
  // return a clear 503 instead if these are unset when actually used.
  adminUsername: process.env.ADMIN_USERNAME || null,
  adminOtpEmails: (process.env.ADMIN_OTP_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Listing photo/video storage — see services/storage.js. The service role
  // key is a secret with full read/write on the project's storage; it must
  // only ever be used server-side, never sent to the frontend.
  supabaseUrl: requiredInProduction('SUPABASE_URL'),
  supabaseServiceRoleKey: requiredInProduction('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'listing-media',

  // Real listing-fee payments — see services/stripeClient.js and
  // routes/payments.js. Not required() at boot (a Stripe-less deployment
  // should still run for everything except actually charging an owner);
  // routes/payments.js returns a clear 503 instead if these are unset when
  // checkout is actually attempted, same pattern as adminUsername above.
  // Required in production so a real deploy can't silently ship with
  // payments dark.
  stripeSecretKey: requiredInProduction('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: requiredInProduction('STRIPE_WEBHOOK_SECRET'),
};
