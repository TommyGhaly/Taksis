/**
 * PaschaReadingUtils.js
 *
 * Canonical reading order:
 *   Prophecies → Homily → Pauline → Catholic → Praxis
 *   → Psalm (Coptic only, multi-reader)
 *   → Gospel (Coptic fixed) → Gospel (Vernacular, language picker)
 *   → Exposition → Litanies
 *
 * Coptic rows always come before vernacular rows within each type.
 */

export const MAX_PSALM_READERS = 4;

export const VERNACULAR_OPTIONS = [
  { value: "english", label: "English", short: "ENGLISH" },
  { value: "arabic",  label: "Arabic",  short: "ARABIC"  },
];

export const READING_META = {
  prophecies:         { label: "Prophecy",         icon: "fire",                color: "#e5c46b" },
  homily:             { label: "Homily",            icon: "microphone-outline",  color: "#f87171" },
  pauline:            { label: "Pauline",           icon: "feather",             color: "#c084fc" },
  catholic:           { label: "Catholic",          icon: "bookshelf",           color: "#67d3cb" },
  praxis:             { label: "Praxis",            icon: "script-text-outline", color: "#fb923c" },
  psalm:              { label: "Psalm",             icon: "music-note",          color: "#7ec8a0" },
  gospel:             { label: "Gospel",            icon: "book-cross",          color: "#38bdf8" },
  gospel_coptic:      { label: "Gospel (Coptic)",   icon: "book-cross",          color: "#38bdf8" },
  gospel_vernacular:  { label: "Gospel",            icon: "book-cross",          color: "#7dd3fc" },
  gospels:            { label: "Gospel",            icon: "book-cross",          color: "#38bdf8" },
  gospels_coptic:     { label: "Gospel (Coptic)",   icon: "book-cross",          color: "#38bdf8" },
  gospels_vernacular: { label: "Gospel",            icon: "book-cross",          color: "#7dd3fc" },
  exposition:         { label: "Exposition",        icon: "comment-text-outline", color: "#a78bfa" },
  litanies:           { label: "Litanies",          icon: "hands-pray",          color: "rgba(255,255,255,0.65)" },
};

// All slot types that get a reader picker
export const ASSIGNABLE = [
  "prophecies",
  "homily",
  "pauline", "catholic", "praxis",
  "psalm",
  "gospel", "gospel_coptic", "gospel_vernacular",
  "gospels", "gospels_coptic", "gospels_vernacular",
  "exposition",
];

const COPTIC_FIXED_KEYS = new Set(["gospel_coptic", "gospels_coptic"]);

export function isAssignableSlot(rKey) {
  return ASSIGNABLE.includes(rKey) && rKey !== "psalm";
}

export function isPsalmSlot(rKey) {
  return rKey === "psalm";
}

export function isExpositionSlot(rKey) {
  return rKey === "exposition";
}

/** Whether this slot shows a language picker */
export function hasLanguagePicker(rKey) {
  if (rKey === "psalm")        return false;
  if (rKey === "litanies")     return false;
  if (rKey === "exposition")   return false;
  if (COPTIC_FIXED_KEYS.has(rKey)) return false;
  return ASSIGNABLE.includes(rKey);
}

export function isCopticFixed(rKey) {
  return COPTIC_FIXED_KEYS.has(rKey) || rKey === "psalm";
}

export function languageOptionsFor() {
  return VERNACULAR_OPTIONS;
}

export function psalmReadersKey() {
  return "psalm_readers";
}

export function langFirestoreKey(slotKey) {
  return `${slotKey}_lang`;
}

export function effectiveLanguage(row, hourAssignments) {
  if (COPTIC_FIXED_KEYS.has(row.rKey)) return "coptic";
  if (row.rKey === "psalm")            return "coptic";
  if (row.rKey === "exposition")       return null; // no language badge
  const override = hourAssignments[langFirestoreKey(row.slotKey)];
  if (override) return override;
  return row.language || "english";
}

export function langDisplay(lang) {
  if (!lang) return "";
  return lang.charAt(0).toUpperCase() + lang.slice(1);
}

export function langShort(lang) {
  if (!lang) return "";
  const map = { english: "ENGLISH", arabic: "ARABIC", coptic: "COPTIC" };
  return map[lang] || lang.slice(0, 2).toUpperCase();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function refOf(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (v.reference) return v.reference;
  return String(v);
}

function langOf(v) {
  if (!v || typeof v === "string") return null;
  return v.language || null;
}

function psalmRef(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (v.reference) return v.reference;
  return "";
}

function isPairedPsalmArray(v) {
  return Array.isArray(v) && v.length > 0 && v[0]?.beforeGospel !== undefined;
}

function gospelRef(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (v.reference) return v.reference;
  return String(v);
}

export function readingDisplay(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.reference) {
    const parts = [value.reference];
    if (value.location) parts.push(`— ${value.location}`);
    return parts.join(" ");
  }
  if (Array.isArray(value))
    return value
      .map(v => {
        if (typeof v === "string") return v;
        if (v.reference) return v.location ? `${v.reference} — ${v.location}` : v.reference;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  return String(value);
}

function sanitizeKey(ref) {
  return ref.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
}

// ─── expandReadings ───────────────────────────────────────────────────────────
// Order: Prophecies → Homily → Pauline → Catholic → Praxis
//        → Psalm → Gospel (Coptic) → Gospel (Vernacular) → Exposition → Litanies
//
// Within each bilingual type, Coptic rows always precede vernacular rows.
export function expandReadings(hour) {
  const r  = hour.readings || {};
  const rf = hour.readings_format || {};
  const rows = [];

  // ── 1. Prophecies
  const prophecies = r.prophecies
    ? Array.isArray(r.prophecies) ? r.prophecies : [r.prophecies]
    : [];
  prophecies.forEach((p, i) => {
    rows.push({
      rKey: "prophecies",
      slotKey: prophecies.length === 1 ? "prophecy" : `prophecy_${i}`,
      index: prophecies.length === 1 ? null : i,
      refText: refOf(p), language: langOf(p), location: "",
      isCoptic: false,
    });
  });

  // ── 2. Homily  (moved up before Pauline)
  if (r.homily) {
    const homilies = Array.isArray(r.homily) ? r.homily : [r.homily];
    homilies.forEach((h, i) => {
      rows.push({
        rKey: "homily",
        slotKey: homilies.length === 1 ? "homily" : `homily_${i}`,
        index: homilies.length === 1 ? null : i,
        refText: h.author, language: langOf(h), location: "",
        author: h.author, isCoptic: false,
      });
    });
  }

  // ── 3. Pauline
  if (r.pauline) {
    rows.push({
      rKey: "pauline", slotKey: "pauline", index: null,
      refText: refOf(r.pauline), language: langOf(r.pauline), location: "",
      isCoptic: false,
    });
  }

  // ── 4. Catholic
  if (r.catholic) {
    rows.push({
      rKey: "catholic", slotKey: "catholic", index: null,
      refText: refOf(r.catholic), language: langOf(r.catholic), location: "",
      isCoptic: false,
    });
  }

  // ── 5. Praxis
  if (r.praxis) {
    rows.push({
      rKey: "praxis", slotKey: "praxis", index: null,
      refText: refOf(r.praxis), language: langOf(r.praxis), location: "",
      isCoptic: false,
    });
  }

  // ── 6. Psalm (Coptic only) + 7. Gospel (Coptic before vernacular)
  const hasPairedPsalms = isPairedPsalmArray(r.psalm);

  if (hasPairedPsalms) {
    const gospels = Array.isArray(r.gospel)
      ? r.gospel.map(g => gospelRef(g))
      : [gospelRef(r.gospel)].filter(Boolean);
    const hasGospelFormat = rf.gospel != null;

    gospels.forEach((gRef, i) => {
      // Psalm (Coptic) always first
      const paired = r.psalm.find(p => p.beforeGospel === gRef);
      if (paired) {
        rows.push({
          rKey: "psalm",
          slotKey: `psalm_before_${sanitizeKey(gRef)}`,
          index: null, refText: psalmRef(paired), language: "coptic", location: "",
          isCoptic: true,
        });
      }
      // Gospel Coptic
      if (hasGospelFormat && rf.gospel.coptic) {
        rows.push({
          rKey: "gospel_coptic",
          slotKey: `gospel_coptic_${sanitizeKey(gRef)}`,
          index: i, refText: gRef, language: "coptic", location: "",
          isCoptic: true,
        });
      }
      if (!hasGospelFormat) {
        rows.push({
          rKey: "gospel",
          slotKey: `gospel_${sanitizeKey(gRef)}`,
          index: i, refText: gRef, language: null, location: "",
          isCoptic: false,
        });
      }
    });
    // Gospel vernacular (one combined reader) comes after all Coptic gospel rows
    if (hasGospelFormat && rf.gospel.vernacular) {
      rows.push({
        rKey: "gospel_vernacular",
        slotKey: "gospel_vernacular_combined",
        index: null, refText: gospels.join(", "),
        language: rf.gospel.vernacular?.language || "english",
        location: "", isCoptic: false,
      });
    }
  } else {
    // Standard psalm — always Coptic
    if (r.psalm) {
      const pRef = typeof r.psalm === "string" ? r.psalm
        : r.psalm?.reference ? r.psalm.reference : psalmRef(r.psalm);
      if (pRef) {
        rows.push({
          rKey: "psalm", slotKey: "psalm", index: null,
          refText: pRef, language: "coptic", location: "",
          isCoptic: true,
        });
      }
    }

    const hasGospelFormat = rf.gospel != null;
    if (hasGospelFormat) {
      // Coptic pass(es) first
      if (rf.gospel.coptic) {
        const copticEntries = Array.isArray(rf.gospel.coptic)
          ? rf.gospel.coptic : [rf.gospel.coptic];
        if (copticEntries.length > 1 || (Array.isArray(r.gospels) && r.gospels.length > 0)) {
          copticEntries.forEach((c, i) => {
            const ref = c.reference || gospelRef(
              Array.isArray(r.gospel) ? r.gospel[i] :
              Array.isArray(r.gospels) ? r.gospels[i] : r.gospel
            );
            rows.push({
              rKey: Array.isArray(r.gospels) ? "gospels_coptic" : "gospel_coptic",
              slotKey: `gospel_coptic_${i}`,
              index: i, refText: ref, language: "coptic", location: "",
              isCoptic: true,
            });
          });
        } else {
          rows.push({
            rKey: "gospel_coptic", slotKey: "gospel_coptic",
            index: null, refText: copticEntries[0]?.reference || gospelRef(r.gospel),
            language: "coptic", location: "", isCoptic: true,
          });
        }
      }
      // Vernacular pass after all Coptic
      if (rf.gospel.vernacular) {
        if (Array.isArray(rf.gospel.vernacular)) {
          rf.gospel.vernacular.forEach((v, i) => {
            const ref = v.reference || gospelRef(
              Array.isArray(r.gospel) ? r.gospel[i] :
              Array.isArray(r.gospels) ? r.gospels[i] : r.gospel
            );
            rows.push({
              rKey: Array.isArray(r.gospels) ? "gospels_vernacular" : "gospel_vernacular",
              slotKey: `gospel_vernacular_${i}`,
              index: i, refText: ref,
              language: v.language || "english",
              location: "", isCoptic: false,
            });
          });
        } else {
          const allRefs = Array.isArray(r.gospel)
            ? r.gospel.map(g => gospelRef(g))
            : Array.isArray(r.gospels)
              ? r.gospels.map(g => refOf(g))
              : [gospelRef(r.gospel)].filter(Boolean);
          rows.push({
            rKey: Array.isArray(r.gospels) ? "gospels_vernacular" : "gospel_vernacular",
            slotKey: "gospel_vernacular",
            index: null, refText: allRefs.length > 1 ? allRefs.join(", ") : allRefs[0] || "",
            language: rf.gospel.vernacular?.language || "english",
            location: "", isCoptic: false,
          });
        }
      }
    } else {
      // v1 fallback — no readings_format
      if (r.gospel && !Array.isArray(r.gospel)) {
        rows.push({
          rKey: "gospel", slotKey: "gospel", index: null,
          refText: gospelRef(r.gospel), language: langOf(r.gospel), location: "",
          isCoptic: false,
        });
      }
      if (Array.isArray(r.gospel)) {
        r.gospel.forEach((g, i) => {
          rows.push({
            rKey: "gospel", slotKey: `gospel_${i}`, index: i,
            refText: gospelRef(g), language: langOf(g), location: "",
            isCoptic: false,
          });
        });
      }
      if (Array.isArray(r.gospels)) {
        r.gospels.forEach(g => {
          rows.push({
            rKey: "gospels", slotKey: `gospel_${g.number}`,
            index: g.number - 1, refText: refOf(g),
            language: langOf(g), location: g.location || "",
            isCoptic: false,
          });
        });
      }
    }
  }

  // ── 8. Exposition
  if (r.exposition !== undefined) {
    rows.push({
      rKey: "exposition", slotKey: "exposition", index: null,
      refText: "", language: null, location: "",
      isCoptic: false,
    });
  }

  // (Litanies are structural/display only — not expanded as assignable rows here)

  return rows;
}

// ─── countSlots ───────────────────────────────────────────────────────────────
export function countSlots(hour, ha) {
  let total = 0, filled = 0;
  const hasPsalm = expandReadings(hour).some(r => r.rKey === "psalm");
  expandReadings(hour).forEach(({ slotKey, rKey }) => {
    if (rKey === "psalm") return;
    if (!isAssignableSlot(rKey)) return;
    total++;
    if (ha[slotKey]) filled++;
  });
  if (hasPsalm) {
    total++;
    if ((ha.psalm_readers || []).length > 0) filled++;
  }
  return { total, filled };
}

// ─── dayProgress ──────────────────────────────────────────────────────────────
export function dayProgress(day, ds) {
  let total = 0, filled = 0;
  (day.hours || []).forEach(h => {
    const s = countSlots(h, ds[h.id] || {});
    total += s.total;
    filled += s.filled;
  });
  return { total, filled };
}