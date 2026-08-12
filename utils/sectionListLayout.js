/**
 * sectionListLayout — `getItemLayout` for the app's SectionLists.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 *
 * Nothing in this app used to supply `getItemLayout`, which meant VirtualizedList
 * had no idea where an unrendered section started. Every A-Z bar and grade chip
 * calls `scrollToLocation` on a section that is, by definition, off-screen — so
 * the jump failed. Each screen papered over that differently and each workaround
 * was wrong in its own way: five screens passed `onScrollToIndexFailed={() => {}}`
 * (a no-op, so tapping a far letter silently did nothing), and the two attendance
 * screens retried after 500ms while passing a *flat* index as a `sectionIndex`.
 *
 * With a real `getItemLayout` the offset of any section is known without having
 * rendered anything, so the jump is exact and instant and none of that is needed.
 *
 * ── The index space (verified against RN 0.79) ────────────────────────────────
 *
 * `VirtualizedSectionList` flattens every section into one index space. Per
 * section, in order:
 *
 *     [ section header ] [ item 0 ] … [ item n-1 ] [ section footer ]
 *
 * A header slot AND a footer slot exist for EVERY section — including the last
 * one, including sections whose `data` is empty, and whether or not
 * `renderSectionFooter` is supplied (an absent footer just renders null at
 * height 0). See VirtualizedSectionList.render():
 *
 *     itemCount += 2;                                   // header + footer
 *     itemCount += this.props.getItemCount(section.data);
 *
 * and `_getItem`, which maps `index - 1 === -1` to the header and
 * `index - 1 === itemCount` to the footer. So:
 *
 *     sectionStart(s) = Σ_{i<s} (data_i.length + 2)   ← the HEADER's flat index
 *     item j of s     = sectionStart(s) + 1 + j
 *     footer of s     = sectionStart(s) + 1 + data_s.length
 *
 * This is also why `scrollToLocation({ itemIndex })` is off by one from what the
 * name suggests: `itemIndex: 0` is the section header and `itemIndex: 1` is data
 * item 0. Call sites here pass 0 — it targets the header directly instead of
 * relying on the sticky-header `viewOffset` compensation to walk back up to it.
 *
 * `ListHeaderComponent` does NOT consume a flat index slot (it only biases
 * `stickyHeaderIndices`), but it IS inside the content container, so its height
 * has to be folded into every offset — that is what `listHeaderHeight` is for.
 * Same for any `contentContainerStyle.paddingTop`. No list in this app has
 * either today; the option exists so that adding one later fails loudly in review
 * rather than silently breaking every jump.
 *
 * ── The catch: heights must be EXACT ──────────────────────────────────────────
 *
 * From VirtualizedList:
 *
 *     const shouldListenForLayout =
 *       getItemLayout == null || debug || this._fillRateHelper.enabled();
 *
 * Supplying `getItemLayout` makes RN stop attaching `onLayout` to cells entirely.
 * There is no reconciliation between what you claim here and what actually
 * renders, and the error accumulates: 1px of drift over 400 rows is a 400px
 * landing error, plus a wrong scroll indicator and content length.
 *
 * So the row styles feeding these constants are pinned rather than estimated —
 * `numberOfLines={1}` on anything that could wrap, an explicit `lineHeight` on
 * every Text that contributes to row height (a Text without one gets the *font's*
 * natural line height, which is not computable in JS and differs between iOS and
 * Android), and a fixed `height` on sub-views whose tallest child is an icon
 * glyph. The screens also carry a `__DEV__`-only drift warning so a future style
 * tweak that changes a row's height reports itself instead of quietly bending
 * every jump on that screen.
 */

/**
 * Builds a `getItemLayout` for a SectionList.
 *
 * @param getItemHeight          (item, sectionIndex, itemIndex) => number
 * @param getSectionHeaderHeight (section, sectionIndex) => number
 * @param getSectionFooterHeight (section, sectionIndex) => number
 * @param listHeaderHeight       height of ListHeaderComponent + any
 *                               contentContainerStyle.paddingTop
 */
export function makeSectionListGetItemLayout({
  getItemHeight,
  getSectionHeaderHeight = () => 0,
  getSectionFooterHeight = () => 0,
  listHeaderHeight = 0,
}) {
  // One-entry prefix table, keyed on `sections` identity.
  //
  // `sections` is a fresh array whenever the roster or the search filter changes
  // and stable otherwise, so a single slot hits ~100% during a scroll or an
  // alphabet-bar drag. That matters: AlphabetIndexBar fires onLetterChange for
  // every letter crossed in one drag, so this is on a hot path.
  let cachedSections = null;
  let offsets = null;
  let lengths = null;

  const build = (sections) => {
    offsets = [];
    lengths = [];
    let offset = listHeaderHeight;

    for (let s = 0; s < sections.length; s++) {
      const section = sections[s];
      const data = section.data || [];

      const headerHeight = getSectionHeaderHeight(section, s);
      offsets.push(offset);
      lengths.push(headerHeight);
      offset += headerHeight;

      for (let j = 0; j < data.length; j++) {
        const itemHeight = getItemHeight(data[j], s, j);
        offsets.push(offset);
        lengths.push(itemHeight);
        offset += itemHeight;
      }

      const footerHeight = getSectionFooterHeight(section, s);
      offsets.push(offset);
      lengths.push(footerHeight);
      offset += footerHeight;
    }

    cachedSections = sections;
  };

  return (sections, index) => {
    if (!sections || sections.length === 0) {
      return { length: 0, offset: 0, index };
    }
    if (sections !== cachedSections) {
      build(sections);
    }
    // Defensive: VirtualizedList should never ask past getItemCount, but a stale
    // ref mid-swap must not throw inside a layout pass.
    if (index < 0 || index >= lengths.length) {
      return { length: 0, offset: offsets[offsets.length - 1] ?? 0, index };
    }
    return { length: lengths[index], offset: offsets[index], index };
  };
}

/**
 * Dev-only guard against the failure mode described above.
 *
 * Because `getItemLayout` turns off RN's own cell measurement, a style tweak that
 * changes a row's real height has no way of announcing itself — the list just
 * starts landing in the wrong place, further off the further you jump. This
 * attaches one `onLayout` to a row in dev builds and complains if what rendered
 * disagrees with the constant the screen is predicting.
 *
 * Returns `undefined` outside __DEV__, so production attaches no listener at all.
 *
 * @param label    what to call this row in the warning
 * @param expected the height constant the screen passes to getItemHeight
 * @param margin   the row root's own marginBottom — onLayout excludes it, but the
 *                 cell wrapper's box includes it, so it belongs in `expected`
 */
export function makeRowHeightAudit(label, expected, margin = 0) {
  if (!__DEV__) return undefined;
  let warned = false;
  return (event) => {
    if (warned) return; // one warning per row type, not one per cell
    const measured = event.nativeEvent.layout.height + margin;
    if (Math.abs(measured - expected) > 0.5) {
      warned = true;
      console.warn(
        `[sectionListLayout] ${label} height drift: getItemLayout predicts ` +
          `${expected.toFixed(1)}px but the row measured ${measured.toFixed(1)}px. ` +
          `Section jumps on this screen will land off by roughly ` +
          `${(measured - expected).toFixed(1)}px per row until the constant is updated.`
      );
    }
  };
}

export default makeSectionListGetItemLayout;
