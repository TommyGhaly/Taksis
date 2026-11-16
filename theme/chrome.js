import React, { useContext } from "react";
import { StyleSheet } from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./ThemeContext";
import { GlassSurface } from "./glass";

// Floating Liquid Glass tab bar geometry.
export const FLOATING_TAB_HEIGHT = 64;
export const FLOATING_TAB_MARGIN = 16;

/**
 * Extra bottom padding a scrolling screen needs so its last row can scroll out
 * from under the floating glass tab bar.
 *
 * Zero whenever the tab bar is in normal layout (glass off) or the screen isn't
 * inside the tab navigator at all (drawer screens, modals), so adding it to a
 * contentContainerStyle never changes the non-glass layout.
 */
export function useTabBarInset() {
  const theme = useTheme();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  if (!theme.glass || tabBarHeight == null) return 0;
  // Pill + the gap under it + breathing room above it, so the last button on
  // a screen is fully visible and tappable, not merely uncovered.
  return FLOATING_TAB_HEIGHT + Math.max(insets.bottom, FLOATING_TAB_MARGIN) + FLOATING_TAB_MARGIN + 12;
}

// Gap between the top of the glass pill and a floating bar/button above it.
const FLOATING_GAP = 12;
// What useTabBarInset adds beyond the pill's top edge (gap under the pill is
// already in the pill-top figure; this is margin + breathing room).
const INSET_ABOVE_PILL = FLOATING_TAB_MARGIN + 12;

/**
 * `bottom` for an absolutely positioned floating element (search bar, FAB,
 * Continue button) given its non-glass `bottom` and the screen's
 * useTabBarInset() value.
 *
 * With the glass tab bar showing, the element sits FLOATING_GAP above the
 * pill — its original offset was measured from an in-layout tab bar and no
 * longer applies. Otherwise it keeps its original offset.
 *
 * Not the same as adding the inset: that's scroll padding (room to scroll the
 * last row past the pill), which would float the element far too high.
 */
export function floatingBottom(original, tabBarInset) {
  if (!tabBarInset) return original;
  return tabBarInset - INSET_ABOVE_PILL + FLOATING_GAP;
}

/**
 * Wraps a header icon button (menu, bell) in a small glass circle when glass
 * is on — the iOS 26 navigation bar look. A pass-through otherwise.
 */
export function HeaderGlassButton({ children, style }) {
  const theme = useTheme();
  if (!theme.glass) return children;
  return (
    <GlassSurface style={[styles.headerButton, style]} interactive>
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
