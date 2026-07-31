/**
 * dateKeys — parsing, comparing and labelling the date strings this app stores.
 *
 * Eleven hand-rolled copies of this logic existed across the screens (`parseDate`
 * ×4, `prettyDate` ×3, `formatWeekDisplay` ×3, `formatDateStr`, `nd`). They agreed
 * on the important things and differed in ways that mattered, so this module is the
 * single source of truth.
 *
 * ── The two on-disk formats ───────────────────────────────────────────────────
 *
 * Both are month-first and hyphen-separated; they differ only in year width:
 *
 *   "MM-DD-YYYY"  attendance field keys on a student/servant document, e.g.
 *                 `{ "06-22-2025": true }`. Always zero-padded — they are written
 *                 by `formatDate` in the attendance screens, which uses
 *                 `padStart(2, "0")`.
 *   "MM-DD-YY"    schedule week ids (`churches/{id}/schedule/{weekId}`) and the
 *                 `unavailableWeeks` / `switched_weeks` / `lastServe` fields.
 *
 * A 2-digit year is read as 20YY, matching every previous copy.
 *
 * ── There is no day-first format ──────────────────────────────────────────────
 *
 * Three files (`unavailableRequestModal.js`, `ServerSelectionModal.js`,
 * `EditSchedule.js`) carried a `DATE_FORMATS` object with a `LAST_SERVE` branch
 * that parsed day-first. That branch was unreachable: `SCHEDULE` and `LAST_SERVE`
 * were both the *string* `"MM-DD-YY"`, so `format === DATE_FORMATS.SCHEDULE`
 * matched first in every call. Everything has always been parsed month-first, and
 * this module keeps it that way — deliberately, not by omission.
 *
 * ── Why a sortable integer instead of Date ────────────────────────────────────
 *
 * Comparators were doing `new Date(...) - new Date(...)`, i.e. two Date allocations
 * per comparison and O(n log n) of them per sort. `YYYYMMDD` as an integer orders
 * identically to chronological order, so `dateKeyToSortable` is computed once per
 * item and compared as a number.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/**
 * True for a zero-padded 4-digit-year attendance field key.
 *
 * Use this to pick attendance entries out of a document's fields. The alternative —
 * excluding a hardcoded list of metadata field names — silently turns any *new*
 * field (`photoURL`, `createdAt`, anything an admin adds via DatabaseManager) into
 * a bogus attendance row, which then reaches the comparator as NaN.
 */
export function isAttendanceDateKey(key) {
  return /^\d{2}-\d{2}-\d{4}$/.test(key);
}

/** Split a key into [month, day, fullYear], or null if it isn't one. */
function parts(key) {
  if (!key || typeof key !== "string") return null;
  const bits = key.split("-");
  if (bits.length !== 3) return null;
  const [month, day, year] = bits.map((b) => parseInt(b, 10));
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return [month, day, year < 100 ? 2000 + year : year];
}

/**
 * `YYYYMMDD` as an integer — directly comparable, no Date allocation.
 * Returns -1 for anything unparseable, which sorts before every real date.
 */
export function dateKeyToSortable(key) {
  const p = parts(key);
  if (!p) return -1;
  const [month, day, year] = p;
  return year * 10000 + month * 100 + day;
}

/** Newest first, for arrays of key strings. */
export function compareDateKeyDesc(a, b) {
  return dateKeyToSortable(b) - dateKeyToSortable(a);
}

/**
 * Newest-first comparator for arrays of objects.
 *
 *   rows.sort(byDateKeyDesc((r) => r.date))
 *
 * The key is re-derived per comparison, which is still far cheaper than allocating
 * two Dates. For very large lists, precompute a `sortKey` field instead.
 */
export function byDateKeyDesc(selector) {
  return (a, b) => dateKeyToSortable(selector(b)) - dateKeyToSortable(selector(a));
}

/** A real Date, or null. Escape hatch for callers that need date arithmetic. */
export function parseDateKey(key) {
  const p = parts(key);
  if (!p) return null;
  const [month, day, year] = p;
  const date = new Date(year, month - 1, day);
  // Rejects impossible dates that Date would silently roll over (e.g. 02-31).
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Label cache.
 *
 * Formatting was happening per row per render, and `toLocaleDateString` goes
 * through Intl — comfortably the most expensive thing in those rows. Date keys are
 * immutable identifiers for a fixed calendar day, so a label can be cached forever.
 *
 * Bounded because a long session browsing many weeks would otherwise grow it
 * without limit. Clearing wholesale (rather than evicting LRU) is fine: the working
 * set is one screen's worth of rows, so it refills immediately and cheaply.
 */
const LABEL_CACHE_LIMIT = 500;
const labelCache = new Map();

function cachedLabel(key, style, build) {
  const cacheKey = `${style}|${key}`;
  const hit = labelCache.get(cacheKey);
  if (hit !== undefined) return hit;

  const label = build();
  if (labelCache.size >= LABEL_CACHE_LIMIT) labelCache.clear();
  labelCache.set(cacheKey, label);
  return label;
}

/**
 * "Sun, Jun 22" — the attendance week-picker label.
 *
 * Built from lookup tables rather than Intl, matching the `prettyDate` helpers it
 * replaces. Unparseable input returns the key unchanged, as those helpers did.
 */
export function shortDateLabel(key) {
  return cachedLabel(key, "short", () => {
    const p = parts(key);
    if (!p) return key || "";
    const [month, day, year] = p;
    const weekday = new Date(year, month - 1, day).getDay();
    return `${DAYS_SHORT[weekday]}, ${MONTHS[month - 1]} ${day}`;
  });
}

/** "Sunday, Jun 22" — replaces `formatWeekDisplay`. */
export function longDateLabel(key) {
  return cachedLabel(key, "long", () => {
    const p = parts(key);
    if (!p) return key || "";
    const [month, day, year] = p;
    const weekday = new Date(year, month - 1, day).getDay();
    return `${DAYS_LONG[weekday]}, ${MONTHS[month - 1]} ${day}`;
  });
}

/** "Sunday, Jun 22, 2025" — the schedule week label, which includes the year. */
export function longDateLabelWithYear(key) {
  return cachedLabel(key, "longYear", () => {
    const p = parts(key);
    if (!p) return key || "";
    const [month, day, year] = p;
    const weekday = new Date(year, month - 1, day).getDay();
    return `${DAYS_LONG[weekday]}, ${MONTHS[month - 1]} ${day}, ${year}`;
  });
}

/** "Sun, Jun 22, 2025" — replaces `formatDateStr`, which included the year. */
export function fullDateLabel(key) {
  return cachedLabel(key, "full", () => {
    const p = parts(key);
    if (!p) return key || "";
    const [month, day, year] = p;
    const weekday = new Date(year, month - 1, day).getDay();
    return `${DAYS_SHORT[weekday]}, ${MONTHS[month - 1]} ${day}, ${year}`;
  });
}

/**
 * Whole weeks from `fromKey` to `toKey` (default: today). Negative if `fromKey` is
 * in the future. Returns null when `fromKey` can't be parsed, so callers can tell
 * "never" apart from "zero weeks ago".
 */
export function weeksBetween(fromKey, toKey = null) {
  const from = parseDateKey(fromKey);
  if (!from) return null;
  const to = toKey ? parseDateKey(toKey) : new Date();
  if (!to) return null;
  return Math.floor((to - from) / (7 * 24 * 60 * 60 * 1000));
}

/**
 * A cutoff `weeks` back from now, as a sortable integer.
 *
 * Callers compare `dateKeyToSortable(key) >= cutoff` instead of building a Date per
 * element. Compute this once per data load, not per render — at module scope it
 * would freeze at app launch and stop advancing across midnight.
 */
export function sortableCutoffWeeksAgo(weeks) {
  const d = new Date();
  d.setDate(d.getDate() - weeks * 7);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
