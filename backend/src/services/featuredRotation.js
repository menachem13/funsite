const pool = require('../db/pool');

/**
 * Picks today's featured listing.
 *
 * Deliberately fair, not popularity- or spend-based (see spec section 3.4):
 * every active, paid listing pays the same flat fee, so the rotation picks
 * whichever eligible listing has gone longest without being featured
 * (never-featured listings first). Kept isolated here so it can be swapped
 * for a paid-boost or popularity-weighted model later without touching
 * callers.
 */
async function pickFeaturedListing(client = pool) {
  const { rows } = await client.query(
    `SELECT id FROM listings
     WHERE status = 'active'
     ORDER BY last_featured_at ASC NULLS FIRST, id ASC
     LIMIT 1`
  );
  return rows[0] || null;
}

/**
 * Runs the daily featured-rotation: picks a listing (if one hasn't already
 * been chosen for today) and records it in featured_log + on the listing
 * itself. Safe to call more than once for the same day — featured_date is
 * unique, so a repeat call is a no-op.
 */
async function runFeaturedRotation(featuredDate = new Date()) {
  const dateStr = featuredDate.toISOString().slice(0, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const already = await client.query('SELECT listing_id FROM featured_log WHERE featured_date = $1', [dateStr]);
    if (already.rows.length > 0) {
      await client.query('ROLLBACK');
      return already.rows[0].listing_id;
    }

    const picked = await pickFeaturedListing(client);
    if (!picked) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('INSERT INTO featured_log (listing_id, featured_date) VALUES ($1, $2)', [picked.id, dateStr]);
    await client.query(
      `UPDATE listings
       SET last_featured_at = now(), featured_count = featured_count + 1
       WHERE id = $1`,
      [picked.id]
    );

    await client.query('COMMIT');
    return picked.id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getFeaturedListingId(featuredDate = new Date()) {
  const dateStr = featuredDate.toISOString().slice(0, 10);
  const { rows } = await pool.query('SELECT listing_id FROM featured_log WHERE featured_date = $1', [dateStr]);
  return rows[0]?.listing_id || null;
}

module.exports = { pickFeaturedListing, runFeaturedRotation, getFeaturedListingId };
