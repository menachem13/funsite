const pool = require('../db/pool');

/** Expires any active listing whose subscription_expires_at has passed. */
async function expireLapsedSubscriptions() {
  const { rows } = await pool.query(
    `UPDATE listings
     SET status = 'expired', updated_at = now()
     WHERE status = 'active' AND subscription_expires_at IS NOT NULL AND subscription_expires_at <= now()
     RETURNING id`
  );
  return rows.map((r) => r.id);
}

module.exports = { expireLapsedSubscriptions };
