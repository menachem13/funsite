const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { sendMail } = require('./mailer');

const TOKEN_TTL_MINUTES = 60;
const MIN_REQUEST_INTERVAL_MS = 60 * 1000;
const BCRYPT_ROUNDS = 12;
const GENERIC_INVALID_MESSAGE = 'This reset link is invalid or has expired — request a new one.';

// A plain SHA-256 digest, not bcrypt: the token is a 32-byte random value,
// so unlike a short OTP or a user's own password, brute-forcing the hash
// isn't a realistic concern — and a deterministic hash is what lets a
// reset link carry only the token and still be looked up directly, with
// no separate identifier (email, user id) needed alongside it.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Always resolves the same way whether or not `email` matched a real
 * account — the route sends back one generic response either way. The
 * actual work happens in the background so a real SMTP call can't leak
 * whether the email was valid via response latency (same reasoning as
 * adminAuth.js's requestOtp).
 */
async function requestReset(email) {
  const normalized = email.toLowerCase();
  // Admin has no password (see adminAuth.js) — excluding that role here
  // means a token can never even be issued for the admin address, not just
  // rejected later.
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE email = $1 AND role IN ('owner', 'renter')`,
    [normalized]
  );
  const user = rows[0];
  if (!user) return;

  issueResetToken(user).catch((err) => {
    console.error('requestReset background processing failed:', err);
  });
}

async function issueResetToken(user) {
  // Don't let rapid re-requests spam the inbox — same cooldown idea as the
  // admin OTP flow, scoped to this one user instead of globally.
  const recent = await pool.query(
    `SELECT created_at FROM password_reset_tokens
     WHERE user_id = $1 AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [user.id]
  );
  if (recent.rows[0] && Date.now() - new Date(recent.rows[0].created_at).getTime() < MIN_REQUEST_INTERVAL_MS) {
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  // Invalidate any earlier pending reset for this user first — only the
  // newest link is ever valid, so an old email lying around (forwarded,
  // left open in a tab) can't be used once a new one's been requested.
  await pool.query(
    `UPDATE password_reset_tokens SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL`,
    [user.id]
  );
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
  await sendMail({
    to: [user.email],
    subject: 'Reset your Funall password',
    text: `We received a request to reset your Funall password.\n\n${resetUrl}\n\nThis link expires in ${TOKEN_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email — your password hasn't been changed.`,
  });
}

/** Verifies the token, sets the new password, and returns the user's row. */
async function resetPassword(token, newPassword) {
  if (newPassword.length < 8) {
    throw new ApiError(400, 'password must be at least 8 characters');
  }

  const tokenHash = hashToken(token);
  const { rows } = await pool.query(
    `SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND consumed_at IS NULL`,
    [tokenHash]
  );
  const row = rows[0];
  if (!row || new Date(row.expires_at) < new Date()) {
    throw new ApiError(400, GENERIC_INVALID_MESSAGE);
  }

  // Atomically claim the token — if a concurrent request (two tabs, a
  // double-click) already consumed it, this affects 0 rows and we bail
  // rather than letting two requests both reset the password.
  const claim = await pool.query(
    `UPDATE password_reset_tokens SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL RETURNING id`,
    [row.id]
  );
  if (claim.rowCount === 0) {
    throw new ApiError(400, GENERIC_INVALID_MESSAGE);
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const { rows: updatedRows } = await pool.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *`,
    [passwordHash, row.user_id]
  );
  return updatedRows[0];
}

module.exports = { requestReset, resetPassword };
