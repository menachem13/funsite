const pool = require('../db/pool');

// Attaches each listing's first-by-position media item as `cover` (or null),
// via one batched query — avoids an N+1 query per card on any endpoint that
// returns a list of listings, which is how listing cards get real photos
// instead of always falling back to the gradient placeholder. Shared by
// routes/listings.js and routes/savedListings.js so both render cards from
// the exact same cover-selection logic.
async function attachCovers(listings) {
  if (listings.length === 0) return listings;
  const ids = listings.map((l) => l.id);
  const { rows: covers } = await pool.query(
    `SELECT DISTINCT ON (listing_id) listing_id, url, type
     FROM listing_media
     WHERE listing_id = ANY($1)
     ORDER BY listing_id, position ASC, id ASC`,
    [ids]
  );
  const byListingId = new Map(covers.map((c) => [c.listing_id, c]));
  return listings.map((l) => ({ ...l, cover: byListingId.get(l.id) || null }));
}

module.exports = attachCovers;
