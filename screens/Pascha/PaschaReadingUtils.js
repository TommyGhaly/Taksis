/**
 * paschaReadingUtils.js  —  Pascha/PaschaReadingUtils.js
 *
 * Canonical Coptic liturgical reading order:
 *   Prophecies → Pauline → Catholic → Praxis → Psalm → Gospel → Homily → Litanies
 */

export const MAX_PSALM_READERS = 4;

export const READING_META = {
  prophecies: { label: "Prophecy",  icon: "fire",                color: "#e5c46b" },
  psalm:      { label: "Psalm",     icon: "music-note",          color: "#7ec8a0" },
  pauline:    { label: "Pauline",   icon: "feather",             color: "#c084fc" },
  catholic:   { label: "Catholic",  icon: "bookshelf",           color: "#67d3cb" },
  praxis:     { label: "Praxis",    icon: "script-text-outline", color: "#fb923c" },
  gospel:     { label: "Gospel",    icon: "book-cross",          color: "#38bdf8" },
  gospels:    { label: "Gospel",    icon: "book-cross",          color: "#38bdf8" },
  homily:     { label: "Homily",    icon: "microphone-outline",  color: "#f87171" },
  litanies:   { label: "Litanies",  icon: "hands-pray",          color: "rgba(255,255,255,0.65)" },
};

// "psalm" kept so psalm rows render; isAssignableSlot() returns false for it.
export const ASSIGNABLE = [
  "prophecies",
  "pauline",
  "catholic",
  "praxis",
  "psalm",
  "gospel",
  "gospels",
  "homily",
];

export function isAssignableSlot(rKey) {
  return rKey !== "psalm" && ASSIGNABLE.includes(rKey);
}

export const READING_ORDER = [
  "prophecies",
  "pauline",
  "catholic",
  "praxis",
  "psalm",
  "gospel",
  "gospels",
  "homily",
  "litanies",
];

export function readingDisplay(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value
      .map(v =>
        typeof v === "string" ? v
          : v.reference ? (v.location ? `${v.reference} — ${v.location}` : v.reference) : ""
      )
      .filter(Boolean)
      .join("\n");
  return String(value);
}

function sanitizeKey(ref) {
  return ref.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
}

// ─── expandReadings ───────────────────────────────────────────────────────────
// Emits rows in canonical order:
// Prophecies → Pauline → Catholic → Praxis → Psalm → Gospel(s) → Homily
export function expandReadings(hour) {
  const r = hour.readings || {};
  const rows = [];

  // ── Prophecies ────────────────────────────────────────────────────────────
  const prophecies = r.prophecies
    ? Array.isArray(r.prophecies) ? r.prophecies : [r.prophecies]
    : [];
  prophecies.forEach((ref, i) => {
    rows.push({
      rKey: "prophecies",
      slotKey: prophecies.length === 1 ? "prophecy" : `prophecy_${i}`,
      index: prophecies.length === 1 ? null : i,
      refText: ref,
      location: "",
    });
  });

  // ── Pauline ───────────────────────────────────────────────────────────────
  if (r.pauline) {
    rows.push({ rKey: "pauline", slotKey: "pauline", index: null, refText: r.pauline, location: "" });
  }

  // ── Catholic ──────────────────────────────────────────────────────────────
  if (r.catholic) {
    rows.push({ rKey: "catholic", slotKey: "catholic", index: null, refText: r.catholic, location: "" });
  }

  // ── Praxis ────────────────────────────────────────────────────────────────
  if (r.praxis) {
    rows.push({ rKey: "praxis", slotKey: "praxis", index: null, refText: r.praxis, location: "" });
  }

  // ── Psalm + Gospel (interleaved for Palm Sunday paired-psalm case) ─────────
  const hasPairedPsalms =
    Array.isArray(r.psalm) && r.psalm.length > 0 && r.psalm[0]?.beforeGospel !== undefined;

  if (hasPairedPsalms) {
    // Palm Sunday Liturgy: each psalm emitted immediately before its paired gospel.
    const gospels = Array.isArray(r.gospel) ? r.gospel : [r.gospel].filter(Boolean);
    gospels.forEach((gospelRef, i) => {
      const paired = r.psalm.find(p => p.beforeGospel === gospelRef);
      if (paired) {
        rows.push({
          rKey: "psalm",
          slotKey: `psalm_before_${sanitizeKey(gospelRef)}`,
          index: null,
          refText: paired.reference,
          location: "",
        });
      }
      rows.push({
        rKey: "gospel",
        slotKey: `gospel_${sanitizeKey(gospelRef)}`,
        index: i,
        refText: gospelRef,
        location: "",
      });
    });
  } else {
    // ── Plain psalm ──────────────────────────────────────────────────────────
    if (r.psalm && typeof r.psalm === "string") {
      rows.push({ rKey: "psalm", slotKey: "psalm", index: null, refText: r.psalm, location: "" });
    }

    // ── Gospel: string ───────────────────────────────────────────────────────
    if (typeof r.gospel === "string") {
      rows.push({ rKey: "gospel", slotKey: "gospel", index: null, refText: r.gospel, location: "" });
    }

    // ── Gospel: plain array ──────────────────────────────────────────────────
    if (Array.isArray(r.gospel)) {
      r.gospel.forEach((ref, i) => {
        rows.push({ rKey: "gospel", slotKey: `gospel_${i}`, index: i, refText: ref, location: "" });
      });
    }

    // ── Gospels: numbered object array { number, reference, location? } ──────
    if (Array.isArray(r.gospels)) {
      r.gospels.forEach(g => {
        rows.push({
          rKey: "gospels",
          slotKey: `gospel_${g.number}`,
          index: g.number - 1,
          refText: g.reference,
          location: g.location || "",
        });
      });
    }
  }

  // ── Homily / Homilies ─────────────────────────────────────────────────────
  if (r.homily) {
    const homilies = Array.isArray(r.homily) ? r.homily : [r.homily];
    homilies.forEach((h, i) => {
      rows.push({
        rKey: "homily",
        slotKey: homilies.length === 1 ? "homily" : `homily_${i}`,
        index: homilies.length === 1 ? null : i,
        refText: h.author,
        location: "",
        author: h.author,
      });
    });
  }

  return rows;
}

// ─── countSlots ───────────────────────────────────────────────────────────────
export function countSlots(hour, ha) {
  let total = 0, filled = 0;
  expandReadings(hour).forEach(({ slotKey, rKey }) => {
    if (!isAssignableSlot(rKey)) return;
    total++;
    if (ha[slotKey]) filled++;
  });
  // Psalm readers are a separate slot toward progress.
  const hasPsalm = expandReadings(hour).some(r => r.rKey === "psalm");
  if (hasPsalm) {
    total++;
    if ((ha.psalm_readers || []).length > 0) filled++;
  }
  return { total, filled };
}

// ─── dayProgress ─────────────────────────────────────────────────────────────
export function dayProgress(day, ds) {
  let total = 0, filled = 0;
  (day.hours || []).forEach(h => {
    const s = countSlots(h, ds[h.id] || {});
    total += s.total;
    filled += s.filled;
  });
  return { total, filled };
}