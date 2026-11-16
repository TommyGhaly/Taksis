import { useTheme } from "./ThemeContext";

// The "no photo" placeholder: white figure on dark grey (#555) for dark mode,
// on light grey (#D1D1D6, iOS systemGray4) for light mode so it doesn't read
// as a dark hole on white cards.
const DARK = require("../assets/default_profile.png");
const LIGHT = require("../assets/default_profile_light.png");

export const defaultAvatarFor = (theme) => (theme?.isDark === false ? LIGHT : DARK);

/** The default profile image for the active theme. */
export function useDefaultAvatar() {
  return defaultAvatarFor(useTheme());
}
