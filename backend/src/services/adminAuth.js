const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { sendMail } = require('./mailer');

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 12;

function assertAdminConfigured() {
  if (!config.adminUsername || config.adminOtpEmails.length === 0) {
    throw new ApiError(503, 'Admin login is not configured (set ADMIN_USERNAME and ADMIN_OTP_EMAILS)');
  }
}

function generateCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Always resolves without error, whether or not `username` was correct — the
 * caller (route) always sends back the same generic response either way, so
 * this endpoint can't be used to test whether the admin username is right.
 */
async function requestOtp(username) {
  assertAdminConfigured();
  if (username !== config.adminUsername) return;

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Only the newest requested code is ever valid.
  await pool.query('DELETE FROM admin_otp_codes WHERE consumed_at IS NULL');
  await pool.query('INSERT INTO admin_otp_codes (code_hash, expires_at) VALUES ($1, $2)', [codeHash, expiresAt]);

  await sendMail({
    to: config.adminOtpEmails,
    subject: 'Funsite admin login code',
    text: `Your admin login code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.\n\nIf you didn't request this, ignore it — no one can act on it without your admin username too.`,
  });
}

/** Verifies the code and returns the admin's users-table row, creating it on first successful login. */
async function verifyOtp(username, code) {
  assertAdminConfigured();
  if (username !== config.adminUsername) {
    throw new ApiError(401, 'Invalid admin credentials');
  }

  const { rows } = await pool.query(
    'SELECT * FROM admin_otp_codes WHERE consumed_at IS NULL ORDER BY created_at DESC LIMIT 1'
  );
  const otpRow = rows[0];
  if (!otpRow) throw new ApiError(401, 'No pending login code — request a new one');
  if (new Date(otpRow.expires_at) < new Date()) throw new ApiError(401, 'Code expired — request a new one');
  if (otpRow.attempts >= MAX_ATTEMPTS) throw new ApiError(429, 'Too many attempts — request a new code');

  const valid = await bcrypt.compare(code, otpRow.code_hash);
  if (!valid) {
    await pool.query('UPDATE admin_otp_codes SET attempts = attempts + 1 WHERE id = $1', [otpRow.id]);
    throw new ApiError(401, 'Incorrect code');
  }

  await pool.query('UPDATE admin_otp_codes SET consumed_at = now() WHERE id = $1', [otpRow.id]);

  const adminEmail = config.adminOtpEmails[0].toLowerCase();
  const existing = await pool.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
  if (existing.rows[0]) return existing.rows[0];

  // First-ever successful OTP login provisions the standing admin user row
  // (role='admin') that requireRole('admin') and FKs like coupons.created_by
  // rely on. password_hash is unusable — admin never authenticates with one.
  const unusablePasswordHash = await bcrypt.hash(crypto.randomUUID(), BCRYPT_ROUNDS);
  const created = await pool.query(
    `INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, 'admin', $3) RETURNING *`,
    [adminEmail, unusablePasswordHash, 'Admin']
  );
  return created.rows[0];
}

module.exports = { requestOtp, verifyOtp };
