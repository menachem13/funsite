// How many of the same six optional-but-valuable fields a listing has
// filled in — mirrors frontend/src/utils/listingCompleteness.js exactly
// (description, a photo/video, location, capacity, event types, age range).
// There's no shared module between the two separately-deployed frontend
// (ESM) and backend (CommonJS) packages, so this predicate is duplicated by
// hand; keep it in sync if listingCompleteness.js's checks ever change.
//
// Expects the query's FROM/JOIN to alias the listings row as `l` and to
// expose a `media.count` column (see either call site for the LATERAL join
// that supplies it).
const COMPLETENESS_TOTAL = 6;
const COMPLETENESS_DONE_SQL = `(
  (CASE WHEN l.description IS NOT NULL AND trim(l.description) <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN COALESCE(media.count, 0) > 0 THEN 1 ELSE 0 END) +
  (CASE WHEN l.location IS NOT NULL AND trim(l.location) <> '' THEN 1 ELSE 0 END) +
  (CASE WHEN l.capacity IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN l.event_types IS NOT NULL AND array_length(l.event_types, 1) > 0 THEN 1 ELSE 0 END) +
  (CASE WHEN l.audience_age_min IS NOT NULL OR l.audience_age_max IS NOT NULL THEN 1 ELSE 0 END)
)`;

const MEDIA_COUNT_LATERAL_JOIN = `
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS count FROM listing_media WHERE listing_id = l.id
  ) media ON true`;

module.exports = { COMPLETENESS_TOTAL, COMPLETENESS_DONE_SQL, MEDIA_COUNT_LATERAL_JOIN };
