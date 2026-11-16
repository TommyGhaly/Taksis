// Semantic color tokens. Screens ask for a role ("surface", "textSecondary"),
// never a hex value, so one table decides what dark and light look like.
//
// The dark palette is the app as it shipped before light mode existed — every
// value here was the most common hardcoded color for that role. Changing a dark
// value changes the app for every existing user.

const shared = {
  accent: "#147EFB", // primary buttons, selected states
  onAccent: "#FFFFFF", // text/icons on an accent fill
  onDanger: "#FFFFFF",
};

export const dark = {
  ...shared,
  isDark: true,

  // Backgrounds, back to front
  background: "#121212", // screen
  surface: "#1A1A1A", // cards, modals, sheets
  surfaceElevated: "#2A2A2A", // inputs/rows inside a card, chips
  surfaceHighest: "#333333",
  chrome: "rgba(34,36,40,1)", // tab bar, headers

  // Text
  text: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.6)",
  textTertiary: "rgba(255,255,255,0.4)",
  textMuted: "#8E8E93",
  placeholder: "rgba(255,255,255,0.4)",
  accentText: "#4D9CFF", // section titles, links on the background
  accentFill: "rgba(20,126,251,0.12)", // tinted chip/icon well behind accent content

  // Lines and translucent fills
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.15)",
  separator: "rgba(255,255,255,0.1)",
  fill: "rgba(255,255,255,0.05)",
  fillStrong: "rgba(255,255,255,0.1)",
  overlay: "rgba(0,0,0,0.7)", // behind modals
  shadow: "#000000",

  // Status
  danger: "#FF3B30",
  dangerText: "#FF453A",
  success: "#34C759",
  successText: "#30D158",
  warning: "#FF9F0A",
  warningText: "#FF9F0A",
  purple: "#BF5AF2",

  // Native integrations
  statusBar: "light",
  blurTint: "systemChromeMaterialDark",
  keyboardAppearance: "dark",
};

export const light = {
  ...shared,
  isDark: false,

  // The inverse of dark's ramp: the screen is the lightest layer and each
  // layer in front of it (cards, then rows/buttons inside them) is a step
  // darker, the way dark mode steps lighter.
  background: "#FFFFFF",
  surface: "#F2F2F7",
  surfaceElevated: "#E5E5EA",
  surfaceHighest: "#D1D1D6",
  chrome: "rgba(249,249,249,1)",

  text: "#000000",
  textSecondary: "rgba(60,60,67,0.6)",
  textTertiary: "rgba(60,60,67,0.3)",
  textMuted: "#6C6C70",
  placeholder: "rgba(60,60,67,0.3)",
  accentText: "#0A6FE0",
  accentFill: "rgba(20,126,251,0.12)",

  border: "rgba(0,0,0,0.08)",
  borderStrong: "rgba(0,0,0,0.18)",
  separator: "rgba(60,60,67,0.18)",
  fill: "rgba(118,118,128,0.08)",
  fillStrong: "rgba(118,118,128,0.16)",
  overlay: "rgba(0,0,0,0.4)",
  shadow: "#000000",

  // iOS light-mode system colors: same hues, darker so they hold contrast on white.
  danger: "#FF3B30",
  dangerText: "#D70015",
  success: "#34C759",
  successText: "#248A3D",
  warning: "#FF9500",
  warningText: "#C93400",
  purple: "#AF52DE",

  statusBar: "dark",
  blurTint: "systemChromeMaterialLight",
  keyboardAppearance: "light",
};
