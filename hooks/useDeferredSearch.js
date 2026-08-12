import { useDeferredValue, useMemo } from "react";

/**
 * Splits a search box into the value the TextInput renders and the value the
 * list filters on.
 *
 * Why: seven roster screens did `onChangeText={setSearchQuery}` and then keyed a
 * grouping memo on `searchQuery` directly. Every keystroke re-filtered the whole
 * roster (order 500 users), rebuilt up to 27 section objects and 27 `data`
 * arrays, and handed SectionList a brand-new `sections` identity. SectionList is
 * a PureComponent, so a new prop identity re-renders every mounted cell — each
 * one carrying an Avatar with a useSyncExternalStore subscription. That is the
 * stutter, and it happened once per character.
 *
 * `useDeferredValue` puts the typed text on the urgent lane and the filtering on
 * a lower-priority one:
 *
 *   const [query, setQuery] = useState("");
 *   const search = useDeferredSearch(query);
 *   const sections = useMemo(() => group(filter(users, search.lower)), [users, search]);
 *   <TextInput value={query} onChangeText={setQuery} />   // never deferred
 *
 * Two things to get right at the call site:
 *
 *  - Keep the TextInput bound to your own state, not to `search.raw`. The caret
 *    has to stay on the urgent lane. Do NOT instead wrap `setQuery` in
 *    `startTransition` — that defers the text itself and the field visibly lags
 *    behind the keyboard.
 *
 *  - Everything describing *the result of a search* must read the returned
 *    value: the sections, the empty-state copy, the alphabet bar's visibility.
 *    Mixing the raw and deferred values makes "No users match your search."
 *    flash for one commit while the list underneath still shows the unfiltered
 *    roster.
 *
 * Chosen over a debounce hook because a debounce charges a fixed 150-250ms on
 * every search, including the ones that would have finished inside a frame, and
 * then does the whole re-group as one uninterruptible chunk when the timer
 * fires — relocating the stutter rather than removing it. `useDeferredValue`
 * costs nothing in the fast case and, when a keystroke lands mid-render, abandons
 * the in-progress work and restarts from the newest value. It also needs no timer,
 * so there is nothing to clean up alongside the `isMounted` refs these screens
 * already juggle.
 *
 * Time-slicing needs a concurrent root, which this app has (the New Architecture
 * is enabled). Under a legacy root this degrades to one extra cheap render per
 * keystroke rather than breaking.
 *
 * The returned object is memoised so a caller can put `search` in a dependency
 * array as one stable entry, instead of `[query]` plus a re-derived
 * `.trim().toLowerCase()` inside every memo that needs it.
 *
 * @param query the raw, undeferred text from the input
 * @returns `{ raw, lower, active }` — the deferred text, its lowercased trim for
 *          matching, and whether a search is in effect at all
 */
export function useDeferredSearch(query) {
  const deferred = useDeferredValue(query);

  return useMemo(() => {
    const trimmed = (deferred || "").trim();
    return {
      raw: deferred,
      lower: trimmed.toLowerCase(),
      active: trimmed.length > 0,
    };
  }, [deferred]);
}

export default useDeferredSearch;
