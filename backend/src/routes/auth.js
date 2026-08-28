const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const adminAuth = require('../services/adminAuth');

const router = express.Router();
const BCRYPT_ROUNDS = 12;
const VALID_ROLES = ['owner', 'renter'];

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, config.jwtSecret, {
    expiresIn: '30d',
  });
}

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role, name: user.name };
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, role, name } = req.body || {};

    if (!email || !password || !role || !name) {
      throw new ApiError(400, 'email, password, role, and name are required');
    }
    if (!VALID_ROLES.includes(role)) {
      throw new ApiError(400, `role must be one of: ${VALID_ROLES.join(', ')}`);
    }
    if (password.length < 8) {
      throw new ApiError(400, 'password must be at least 8 characters');
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      throw new ApiError(409, 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role, name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, name, created_at`,
      [email.toLowerCase(), passwordHash, role, name]
    );
    const user = rows[0];
    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw new ApiError(400, 'email and password are required');
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = rows[0];
    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // Admin has no password — it's a fixed username + emailed OTP, see below.
    // Checked before bcrypt.compare: an admin row's password_hash is an
    // unusable random value that could never match anyway.
    if (user.role === 'admin') {
      throw new ApiError(401, 'Admin accounts log in via /auth/admin/request-otp, not a password');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new ApiError(401, 'Invalid email or password');
    }

    res.json({ user: publicUser(user), token: signToken(user) });
  })
);

// Step 1 of admin login: request a one-time code be emailed to the
// configured admin address(es). Always responds the same way regardless of
// whether `username` was actually correct, so this can't be used to test it.
router.post(
  '/admin/request-otp',
  asyncHandler(async (req, res) => {
    const { username } = req.body || {};
    if (!username) throw new ApiError(400, 'username is required');

    await adminAuth.requestOtp(username);
    res.json({ message: 'If the username is correct, a login code has been sent.' });
  })
);

// Step 2: exchange the emailed code for a normal JWT (role: admin).
router.post(
  '/admin/verify-otp',
  asyncHandler(async (req, res) => {
    const { username, code } = req.body || {};
    if (!username || !code) throw new ApiError(400, 'username and code are required');

    const user = await adminAuth.verifyOtp(username, code);
    res.json({ user: publicUser(user), token: signToken(user) });
  })
);

module.exports = router;
