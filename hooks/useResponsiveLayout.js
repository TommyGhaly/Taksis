import { createContext, useContext, useMemo } from "react";
import { Dimensions, Platform, useWindowDimensions } from "react-native";

// Device class, fixed for the life of the process (rotation never changes it).
// Use it for things like "iPad gets bigger type"; use `isWide` from the hook
// for anything about how much room there actually is.
const screen = Dimensions.get("screen");
export const IS_TABLET =
  Platform.isPad || Math.min(screen.width, screen.height) >= 600;

// Below this a window is laid out like a phone, even on an iPad — a Slide Over
// or 1/3 Split View window is phone-width.
export const WIDE_MIN = 700;

/**
 * The width a screen actually has to lay out in, published by
 * `withContentColumn`. On an iPad that is narrower than the window — the
 * content sits in a centered column, and in landscape a permanent sidebar
 * takes 280pt — so anything sized off `Dimensions`/`useWindowDimensions`
 * comes out too wide. Null outside a column (phones, unwrapped screens).
 */
export const ContentWidthContext = createContext(null);

/** Width available to the current screen: its column if it has one, else the window. */
export function useContentWidth() {
  const columnWidth = useContext(ContentWidthContext);
  const { width } = useWindowDimensions();
  return columnWidth != null ? columnWidth : width;
}

/**
 * Live layout metrics for the current screen.
 *
 * Re-lays out on rotation and on iPad multitasking resizes. Module-level
 * `Dimensions.get("window")` — which most screens here used — is captured once
 * at import time and goes stale the moment the iPad rotates.
 *
 * `gutter` is the horizontal padding that centers a column of at most
 * `maxContentWidth` in the available width; on phones it is just `phoneGutter`.
 */
export default function useResponsiveLayout(options) {
  const maxContentWidth = (options && options.maxContentWidth) || 720;
  const phoneGutter = (options && options.phoneGutter) || 16;
  const width = useContentWidth();
  const { width: windowWidth, height } = useWindowDimensions();

  return useMemo(() => {
    const isWide = width >= WIDE_MIN;
    const isLandscape = windowWidth > height;
    const gutter = isWide
      ? Math.max(24, Math.round((width - maxContentWidth) / 2))
      : phoneGutter;
    return {
      width,
      height,
      isTablet: IS_TABLET,
      isWide,
      isLandscape,
      gutter,
      contentWidth: width - gutter * 2,
    };
  }, [width, windowWidth, height, maxContentWidth, phoneGutter]);
}
