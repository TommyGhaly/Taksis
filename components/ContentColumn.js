import React, { useCallback, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { ContentWidthContext, WIDE_MIN } from "../hooks/useResponsiveLayout";

/**
 * Lays a screen out in a centered column of at most `maxWidth` when there is
 * room for more (iPad), and edge to edge otherwise (phones, narrow Split View).
 *
 * Every screen in the app was built for a ~400pt phone; stretched across a
 * 1,200pt iPad the cards, rows and buttons turn into bars with their content
 * stranded at either end. A column keeps them phone-proportioned and puts them
 * where the eye is.
 *
 * The tree is identical in both modes — only styles change — so rotating the
 * iPad or dragging a Split View divider never remounts the screen and never
 * loses its state. The width actually given to the screen is measured and
 * published through ContentWidthContext; `useContentWidth()` /
 * `useResponsiveLayout()` read it, so a screen that sizes things in code gets
 * the column's width rather than the window's.
 *
 * Absolutely positioned children (floating search bars, FABs) are laid out
 * inside the column, which is what we want. `Modal`s are not — they render at
 * the window root and are unaffected.
 */
export default function withContentColumn(Screen, options) {
  const maxWidth = (options && options.maxWidth) || 760;
  const backgroundColor = (options && options.backgroundColor) || "#121212";

  function ContentColumn(props) {
    const window = useWindowDimensions();
    // Seeded from the window so the first frame is already close; corrected
    // by onLayout (the drawer, when permanent, takes some of the window).
    const [available, setAvailable] = useState(window.width);
    const onLayout = useCallback((e) => setAvailable(e.nativeEvent.layout.width), []);

    const wide = available >= WIDE_MIN;
    const columnWidth = wide ? Math.min(available, maxWidth) : available;

    return (
      <View style={{ flex: 1, backgroundColor }} onLayout={onLayout}>
        <View style={{ flex: 1, width: columnWidth, alignSelf: "center" }}>
          <ContentWidthContext.Provider value={columnWidth}>
            <Screen {...props} />
          </ContentWidthContext.Provider>
        </View>
      </View>
    );
  }
  ContentColumn.displayName = "ContentColumn(" + (Screen.displayName || Screen.name || "Screen") + ")";
  return ContentColumn;
}
