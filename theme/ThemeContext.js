import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dark, light, lightGlass } from "./palettes";
import { glassAvailable } from "./glass";

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

const PREFS_KEY = "@taksis/themePrefs";

// Dark is the default so nobody's app changes until they pick something.
const DEFAULT_PREFS = { appearance: "dark", glassEnabled: false, glassIntensity: 0.4 };

// Earlier builds stored glass as a boolean `liquidGlass`, then as a named
// `glassLevel`; carry either forward to the switch + intensity pair.
const LEVEL_TO_INTENSITY = { clear: 0, regular: 0.4, tinted: 0.85 };
function migratePrefs(saved) {
  if (!saved) return null;
  const { liquidGlass, glassLevel, ...rest } = saved;
  if (rest.glassEnabled == null) {
    if (glassLevel != null) {
      rest.glassEnabled = glassLevel !== "off";
      if (glassLevel in LEVEL_TO_INTENSITY) rest.glassIntensity = LEVEL_TO_INTENSITY[glassLevel];
    } else if (liquidGlass != null) {
      rest.glassEnabled = !!liquidGlass;
    }
  }
  if (typeof rest.glassIntensity !== "number" || !(rest.glassIntensity >= 0 && rest.glassIntensity <= 1)) {
    delete rest.glassIntensity;
  }
  return rest;
}

// Read as soon as this module loads, in parallel with Firebase auth start-up,
// so the provider almost never has to wait for it.
let loadedPrefs = null;
const prefsReady = AsyncStorage.getItem(PREFS_KEY)
  .then((raw) => {
    loadedPrefs = { ...DEFAULT_PREFS, ...migratePrefs(raw ? JSON.parse(raw) : null) };
  })
  .catch(() => {
    loadedPrefs = DEFAULT_PREFS;
  });

// Native UI the app doesn't draw itself (alerts, pickers, the keyboard,
// date pickers, action sheets) follows the window's interface style. Forcing
// it keeps those in step with an explicit choice; null hands control back to
// the system for "system".
function applyNativeAppearance(appearance) {
  Appearance.setColorScheme(appearance === "system" ? null : appearance);
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [prefs, setPrefs] = useState(loadedPrefs);

  useEffect(() => {
    if (prefs) return;
    prefsReady.then(() => setPrefs(loadedPrefs));
  }, [prefs]);

  useEffect(() => {
    if (prefs) applyNativeAppearance(prefs.appearance);
  }, [prefs?.appearance]);

  // With an explicit override in place this reports the override, which is
  // what we want; with "system" it reports the device setting.
  const systemScheme = useColorScheme();

  const updatePrefs = useCallback((patch) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => {
    if (!prefs) return null;
    const scheme =
      prefs.appearance === "system" ? (systemScheme === "light" ? "light" : "dark") : prefs.appearance;
    const glass = prefs.glassEnabled && glassAvailable;
    const palette = scheme === "light" ? (glass ? lightGlass : light) : dark;
    // Styles only care whether glass is on, not how strong it is, so intensity
    // stays out of `key` and moving the slider doesn't rebuild style sheets.
    const glassIntensity = prefs.glassIntensity;
    return {
      theme: { ...palette, scheme, glass, glassIntensity, key: `${scheme}${glass ? "-glass" : ""}` },
      prefs,
      updatePrefs,
    };
  }, [prefs, systemScheme, updatePrefs]);

  // Holding the first frame for a single AsyncStorage read (~ms) beats
  // painting dark and then flashing to light.
  if (!value) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active palette plus `scheme`, `isDark` and `glass`. */
export function useTheme() {
  return useContext(ThemeContext).theme;
}

/** `{ prefs: { appearance, liquidGlass }, updatePrefs(patch) }` for the Settings screen. */
export function useThemePrefs() {
  const { prefs, updatePrefs } = useContext(ThemeContext);
  return { prefs, updatePrefs, glassAvailable };
}

/**
 * Themed replacement for a module-level `StyleSheet.create`.
 *
 *   const useStyles = makeStyles((t) => ({ card: { backgroundColor: t.surface } }));
 *   function Screen() { const styles = useStyles(); ... }
 *
 * Each sheet is built once per theme (not per render or per instance), so a
 * list of 200 rows calling useStyles() shares one object.
 */
export function makeStyles(factory) {
  const cache = new Map();
  return function useStyles() {
    const theme = useTheme();
    let sheet = cache.get(theme.key);
    if (!sheet) {
      sheet = StyleSheet.create(factory(theme));
      cache.set(theme.key, sheet);
    }
    return sheet;
  };
}

export const isIOS = Platform.OS === "ios";
