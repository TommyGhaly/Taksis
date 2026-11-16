import React from "react";
import { Platform, StyleSheet, View } from "react-native";

// expo-glass-effect wraps iOS 26's UIGlassEffect. Required inside try so a
// build that predates the native module (an older dev client, Android) still
// bundles and simply reports glass as unavailable.
let GlassModule = null;
try {
  GlassModule = require("expo-glass-effect");
} catch {
  GlassModule = null;
}

/** True only on iOS 26+ with the native module linked. Fixed for the app's life. */
export const glassAvailable = (() => {
  if (Platform.OS !== "ios" || !GlassModule) return false;
  try {
    return GlassModule.isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

export const GlassView = GlassModule?.GlassView ?? null;
export const GlassContainer = GlassModule?.GlassContainer ?? View;

// Lazy so palettes/ThemeContext can import this file without a cycle.
function useThemeLazy() {
  return require("./ThemeContext").useTheme();
}

// Maps the 0–1 intensity slider onto UIGlassEffect, which only has two native
// styles. The bottom of the range is `.clear` (most see-through); above
// CLEAR_UNTIL it switches to `.regular` (frosted) and a wash of the surface
// color fades in toward "Tinted" — iOS 26.1's own recipe for legible glass.
// The clear segment carries a light wash too, so crossing CLEAR_UNTIL doesn't
// visibly jump.
const CLEAR_UNTIL = 0.2;
const MAX_WASH = 0.75;
const WASH_RGB = { dark: "28,28,30", light: "255,255,255" };

// `minIntensity` floors the user's slider for one surface: a full-height sheet
// of text over other text (the drawer) is unreadable as clear glass.
function levelProps(theme, { clear, tint, minIntensity = 0 }) {
  const t = Math.min(1, Math.max(minIntensity, theme.glassIntensity ?? 0.4));
  const isClear = clear || t < CLEAR_UNTIL;
  const alpha = isClear ? (t / CLEAR_UNTIL) * 0.2 : ((t - CLEAR_UNTIL) / (1 - CLEAR_UNTIL)) * MAX_WASH;
  return {
    glassEffectStyle: isClear ? "clear" : "regular",
    // A caller's own tint (an accent-colored button) always wins.
    tintColor: tint ?? (alpha > 0.01 ? `rgba(${WASH_RGB[theme.scheme]},${alpha.toFixed(2)})` : undefined),
  };
}

/**
 * A card, sheet, or bar background. With Liquid Glass on it renders a glass
 * pane shaped by the style's borderRadius, at the user's chosen intensity
 * (clear → tinted); otherwise a plain View with the
 * style untouched, so the non-glass look is exactly what the screen defined.
 *
 * The style's own backgroundColor is dropped under glass — a solid fill would
 * hide the effect. Pass `tint` to color the glass (e.g. an accent button).
 */
export function GlassSurface({ style, children, interactive = false, tint, clear = false, minIntensity, ...rest }) {
  const theme = useThemeLazy();
  if (!theme.glass || !GlassView) {
    return (
      <View style={style} {...rest}>
        {children}
      </View>
    );
  }
  const { backgroundColor, ...flat } = StyleSheet.flatten(style) || {};
  // Glass draws its own edge highlight, so the theme's neutral hairlines are
  // dropped — but a meaningful colored outline (selected, archived, error)
  // is kept.
  if (flat.borderColor === theme.border || flat.borderColor === theme.borderStrong) {
    flat.borderColor = "transparent";
  }
  return (
    <GlassView
      style={flat}
      {...levelProps(theme, { clear, tint, minIntensity })}
      isInteractive={interactive}
      {...rest}
    >
      {children}
    </GlassView>
  );
}

/**
 * Fills its parent with glass (or the given solid color when glass is off).
 * For navigator backgrounds: `headerBackground`, `tabBarBackground`.
 */
export function GlassBackdrop({ color, style }) {
  const theme = useThemeLazy();
  if (theme.glass && GlassView) {
    return <GlassView style={[StyleSheet.absoluteFill, style]} {...levelProps(theme, {})} />;
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: color ?? theme.chrome }, style]} />;
}
