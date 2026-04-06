/**
 * DayConstants.js
 *
 * Single source of truth for day display labels + short labels.
 * Imported by PaschaManager, PaschaHomePage, PaschaArchiveViewer.
 *
 * The "eve" days clarify which calendar night they fall on:
 *   Monday Eve   = the evening OF Monday   = Tuesday night in Coptic reckoning
 *   Tuesday Eve  = the evening OF Tuesday  = Wednesday night
 *   etc.
 *
 * The label in parentheses is the Western calendar night so readers know
 * which physical night to show up.
 *
 * NOTE: This file is only used for static fallback short labels.
 * The authoritative label now comes from Firestore (pascha/schedule).
 * If the Firestore doc has a shortLabel field, that wins.
 * These serve as the default when shortLabel is absent.
 */

export const DAY_SHORT_LABELS = {
  last_friday_lent:    "Lent Fri",
  palm_sunday:         "Palm Sun",
  monday_eve:          "Mon Eve",      // Monday Eve (Tuesday Night)
  monday_morning:      "Mon Morn",
  tuesday_eve:         "Tue Eve",      // Tuesday Eve (Wednesday Night)
  tuesday_morning:     "Tue Morn",
  wednesday_eve:       "Wed Eve",      // Wednesday Eve (Thursday Night)
  wednesday_morning:   "Wed Morn",
  thursday_eve:        "Thu Eve",      // Thursday Eve (Friday Night)
  covenant_thursday:   "Cov Thu",
  good_friday_eve:     "Fri Eve",      // Good Friday Eve (Saturday Night)
  good_friday_morning: "Fri Morn",
};

/**
 * The full labels now come from Firestore, but update PaschaSchedule.json
 * to match so the Python script uploads the correct labels:
 *
 *   monday_eve        → "Monday Eve (Tuesday Night)"
 *   tuesday_eve       → "Tuesday Eve (Wednesday Night)"
 *   wednesday_eve     → "Wednesday Eve (Thursday Night)"
 *   thursday_eve      → "Thursday Eve (Friday Night)"
 *   good_friday_eve   → "Good Friday Eve (Saturday Night)"
 *
 * Run upload_pascha_schedule.py after updating the JSON.
 */