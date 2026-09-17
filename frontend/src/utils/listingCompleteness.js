// Which optional-but-valuable listing fields are filled in. Used only for
// owner-facing guidance (the dashboard table and the edit-listing form) —
// none of these are required, and a listing works fine with none of them
// set. This never gates publishing or payment, it just nudges an owner
// toward adding the details customers see on the card/detail/inquiry (see
// Phase 3 items #1-3): photos, capacity, suitable event types, age range,
// location, description.
// Each check reuses the same translation key as the matching form field's
// own label, so the checklist and the form it's guiding never say two
// different things for the same piece of information.
const CHECKS = [
  { key: "description", labelKey: "dashboard.formDescription", test: (l) => !!(l.description && l.description.trim()) },
  { key: "photos", labelKey: "dashboard.photosVideoTitle", test: (l) => (l.media_count ?? 0) > 0 },
  { key: "location", labelKey: "dashboard.formCity", test: (l) => !!(l.location && l.location.trim()) },
  { key: "capacity", labelKey: "dashboard.formCapacity", test: (l) => l.capacity != null },
  { key: "eventTypes", labelKey: "dashboard.formEventTypes", test: (l) => Array.isArray(l.event_types) && l.event_types.length > 0 },
  { key: "ageRange", labelKey: "dashboard.completenessAgeRange", test: (l) => l.audience_age_min != null || l.audience_age_max != null },
];

export function listingCompletenessChecklist(listing) {
  return CHECKS.map(({ key, labelKey, test }) => ({ key, labelKey, done: test(listing) }));
}

export function listingCompletenessCount(listing) {
  const checklist = listingCompletenessChecklist(listing);
  return { done: checklist.filter((c) => c.done).length, total: checklist.length };
}
