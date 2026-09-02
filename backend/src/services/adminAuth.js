const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { sendMail } = require('./mailer');

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MIN_REQUEST_INTERVAL_MS = 30 * 1000;
const BCRYPT_ROUNDS = 12;
const GENERIC_INVALID_MESSAGE = 'Invalid code or login expired — request a new code';

function assertAdminConfigured() {
  if (!config.adminUsername || config.adminOtpEmails.length === 0) {
    throw new ApiError(503, 'Admin login is not configured (set ADMIN_USERNAME and ADMIN_OTP_EMAILS)');
  }
}

function generateCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// A fixed, meaningless hash to compare against on invalid-input paths in
// verifyOtp, purely so those paths pay the same bcrypt cost a real
// comparison would — otherwise a wrong guess resolves measurably faster
// than a right one, and that gap is itself an oracle. Cached, but a failed
// hash isn't cached — a permanently-rejected promise here would 500 every
// future invalid-login attempt instead of the intended 401.
let dummyHashPromise = null;
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash('otp-timing-pad', BCRYPT_ROUNDS).catch((err) => {
      dummyHashPromise = null;
      throw err;
    });
  }
  return dummyHashPromise;
}

// In-process serialization for OTP issuance — only one issueNewOtp() body
// runs at a time, so the cooldown check below can't be raced by concurrent
// requests all reading the same pre-write state. Deliberately NOT a
// Postgres advisory lock: that approach held a checked-out pool connection
// for the whole time a request waited its turn, and since requestOtp is
// fire-and-forget (unbounded concurrent calls aren't throttled by the
// client waiting on a response), a burst of requests could exhaust the
// connection pool and starve the rest of the app. This only serializes
// within a single Node process — correct for Render's free tier (one
// instance), but would need a real distributed lock if this ever runs
// horizontally scaled behind a load balancer.
let otpMutex = Promise.resolve();
function withOtpMutex(fn) {
  const run = otpMutex.then(fn, fn);
  otpMutex = run.then(
    () => {},
    () => {}
  );
  return run;
}

/**
 * Returns almost immediately, whether or not `username` was correct — the
 * caller (route) always sends back the same generic response either way.
 * The actual work happens in the background rather than being awaited here,
 * since it can include a real SMTP call (once wired) that's slow enough on
 * its own to leak whether the username was right via response latency.
 */
async function requestOtp(username) {
  assertAdminConfigured();
  if (username !== config.adminUsername) return;

  withOtpMutex(issueNewOtp).catch((err) => {
    console.error('requestOtp background processing failed:', err);
  });
}

async function issueNewOtp() {
  // Don't let a rapid-fire second request invalidate a code the real admin
  // already has in their inbox — only the newest code is ever valid (see
  // verifyOtp), so without this an attacker who somehow learned the
  // username could permanently lock the real admin out just by
  // re-requesting. Checked (and the code below only generated/hashed)
  // after confirming the username was right — an unauthenticated flood of
  // wrong-username requests should cost nothing beyond that one comparison.
  const recent = await pool.query(
    'SELECT created_at FROM admin_otp_codes WHERE consumed_at IS NULL ORDER BY created_at DESC LIMIT 1'
  );
  if (recent.rows[0] && Date.now() - new Date(recent.rows[0].created_at).getTime() < MIN_REQUEST_INTERVAL_MS) {
    return;
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await pool.query('DELETE FROM admin_otp_codes WHERE consumed_at IS NULL');
  await pool.query('INSERT INTO admin_otp_codes (code_hash, expires_at) VALUES ($1, $2)', [codeHash, expiresAt]);

  await sendMail({
    to: config.adminOtpEmails,
    subject: 'Funall admin login code',
    text: `Your admin login code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.\n\nIf you didn't request this, ignore it — no one can act on it without your admin username too.`,
  });
}

/** Verifies the code and returns the admin's users-table row, creating it on first successful login. */
async function verifyOtp(username, code) {
  assertAdminConfigured();

  const { rows } = await pool.query(
    'SELECT * FROM admin_otp_codes WHERE consumed_at IS NULL ORDER BY created_at DESC LIMIT 1'
  );
  const otpRow = rows[0];
  const usernameCorrect = username === config.adminUsername;

  // Wrong username, no pending code, and an expired code all collapse into
  // the exact same response: same message, same status, and — via the
  // extra no-op round trip plus dummy compare — comparable timing to the
  // valid-username path below (which pays one extra query, the attempt
  // claim, before its own bcrypt.compare). Distinguishing any of these
  // would let this endpoint be used to confirm ADMIN_USERNAME without ever
  // having a real code.
  if (!usernameCorrect || !otpRow || new Date(otpRow.expires_at) < new Date()) {
    await pool.query('SELECT 1');
    await bcrypt.compare(code || '', await getDummyHash());
    throw new ApiError(401, GENERIC_INVALID_MESSAGE);
  }

  // Atomically claims one guess against MAX_ATTEMPTS in the same statement
  // that checks it — a separate read-then-increment would let concurrent
  // guesses all read the same stale attempts count and bypass the cap.
  // "Too many attempts" deliberately returns the exact same 401 as every
  // other failure here (not a distinct 429): a distinct response would
  // itself confirm the username was correct and a code is actively pending.
  const claimAttempt = await pool.query(
    `UPDATE admin_otp_codes SET attempts = attempts + 1
     WHERE id = $1 AND consumed_at IS NULL AND attempts < $2
     RETURNING *`,
    [otpRow.id, MAX_ATTEMPTS]
  );
  const claimedRow = claimAttempt.rows[0];
  if (!claimedRow) {
    // Attempts exhausted (or the code was consumed a moment ago) — still
    // pays a real bcrypt cost via the dummy hash so this isn't the one
    // branch in this function that resolves suspiciously fast.
    await bcrypt.compare(code || '', await getDummyHash());
    throw new ApiError(401, GENERIC_INVALID_MESSAGE);
  }

  const valid = await bcrypt.compare(code || '', claimedRow.code_hash);
  if (!valid) {
    throw new ApiError(401, GENERIC_INVALID_MESSAGE);
  }

  // Atomically claim the code itself: if another concurrent request already
  // consumed it between our SELECT above and here, this affects 0 rows and
  // we bail instead of letting two requests both proceed to sign a token.
  // Same generic message as every other failure here — this one specifically
  // only fires when the code WAS correct but a concurrent duplicate
  // submission won the race, so a distinct message would confirm that.
  const claim = await pool.query(
    'UPDATE admin_otp_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL RETURNING id',
    [otpRow.id]
  );
  if (claim.rowCount === 0) {
    throw new ApiError(401, GENERIC_INVALID_MESSAGE);
  }

  return findOrCreateAdminUser();
}

async function lookupAdminEmail(adminEmail) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [adminEmail]);
  const existing = rows[0];
  if (!existing) return null;
  if (existing.role !== 'admin') {
    // Someone registered a normal owner/renter account at this address
    // before the admin's first OTP login. Binding to it silently would
    // hand the admin session to whatever role that row has (or worse, let
    // its original registrant recognize their account was reused) — refuse
    // instead and make the operator resolve it deliberately.
    throw new ApiError(
      409,
      `${adminEmail} is already registered as a non-admin account — use a different ADMIN_OTP_EMAILS address, or resolve the conflict in the database, before admin login can work.`
    );
  }
  return existing;
}

// Finds the standing admin user row (email = first ADMIN_OTP_EMAILS address),
// creating it on first successful login. password_hash is unusable — admin
// never authenticates with one, see routes/auth.js's /login handler.
async function findOrCreateAdminUser() {
  const adminEmail = config.adminOtpEmails[0].toLowerCase();

  const existing = await lookupAdminEmail(adminEmail);
  if (existing) return existing;

  try {
    const unusablePasswordHash = await bcrypt.hash(crypto.randomUUID(), BCRYPT_ROUNDS);
    const created = await pool.query(
      `INSERT INTO users (email, password_hash, role, name) VALUES ($1, $2, 'admin', $3) RETURNING *`,
      [adminEmail, unusablePasswordHash, 'Admin']
    );
    return created.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      // Lost a race to create this row — someone else's concurrent request
      // (or a squatting registration) just landed. Re-check rather than fail.
      const raced = await lookupAdminEmail(adminEmail);
      if (raced) return raced;
    }
    throw err;
  }
}

module.exports = { requestOtp, verifyOtp };
