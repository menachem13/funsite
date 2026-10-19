// Shared helpers for the optional "event date" a customer can attach to
// their discovery/contact context (see Home's find panel, Browse filters,
// and ListingDetail's pre-filled message). Dates are always handled as
// plain "YYYY-MM-DD" strings — the native <input type="date"> format —
// and parsed as local calendar dates, never UTC, so a date typed by the
// customer never shifts by a day depending on the viewer's timezone.

export function todayInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseInputDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

// A date is only ever taken at face value if it parses and isn't in the
// past — a stale or hand-edited URL param should just be dropped rather
// than presented as a real future event date.
export function isValidFutureDate(value) {
  const date = parseInputDate(value);
  if (!date) return false;
  const today = parseInputDate(todayInputValue());
  return date.getTime() >= today.getTime();
}

// Formats a "YYYY-MM-DD" value the way a reader would naturally expect:
// "July 15, 2027".
export function formatEventDate(value) {
  const date = parseInputDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(date);
}
