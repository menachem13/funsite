require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
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
};
