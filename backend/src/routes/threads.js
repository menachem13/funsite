const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function loadParticipantThread(threadId, userId) {
  const { rows } = await pool.query('SELECT * FROM threads WHERE id = $1', [threadId]);
  const thread = rows[0];
  if (!thread) throw new ApiError(404, 'Thread not found');
  if (thread.owner_id !== userId && thread.renter_id !== userId) {
    throw new ApiError(403, 'You are not part of this thread');
  }
  return thread;
}

// GET /threads — inbox: all threads for the current user, with last message + unread count
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT
         t.*,
         l.title AS listing_title,
         lm.body AS last_message_body,
         lm.created_at AS last_message_at,
         lm.sender_id AS last_message_sender_id,
         COALESCE(unread.count, 0)::int AS unread_count
       FROM threads t
       JOIN listings l ON l.id = t.listing_id
       LEFT JOIN LATERAL (
         SELECT body, created_at, sender_id FROM messages
         WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS count FROM messages
         WHERE thread_id = t.id AND sender_id != $1 AND read_at IS NULL
       ) unread ON true
       WHERE t.owner_id = $1 OR t.renter_id = $1
       ORDER BY COALESCE(lm.created_at, t.created_at) DESC`,
      [req.user.id]
    );

    res.json({ threads: rows });
  })
);

// GET /threads/:id — full history, marks incoming messages as read
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const threadId = parseInt(req.params.id, 10);
    const thread = await loadParticipantThread(threadId, req.user.id);

    await pool.query(
      `UPDATE messages SET read_at = now()
       WHERE thread_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [threadId, req.user.id]
    );

    const { rows: messages } = await pool.query(
      'SELECT * FROM messages WHERE thread_id = $1 ORDER BY created_at ASC',
      [threadId]
    );

    res.json({ thread, messages });
  })
);

// POST /threads/:id/messages — reply within an existing thread
router.post(
  '/:id/messages',
  authenticate,
  asyncHandler(async (req, res) => {
    const threadId = parseInt(req.params.id, 10);
    const thread = await loadParticipantThread(threadId, req.user.id);

    const { body } = req.body || {};
    if (!body || !body.trim()) {
      throw new ApiError(400, 'body is required');
    }

    const { rows } = await pool.query(
      'INSERT INTO messages (thread_id, sender_id, body) VALUES ($1, $2, $3) RETURNING *',
      [thread.id, req.user.id, body.trim()]
    );

    res.status(201).json({ message: rows[0] });
  })
);

module.exports = router;
