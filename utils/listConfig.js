/**
 * listConfig — the house virtualization settings for every long list in the app.
 *
 * These props used to be copy-pasted into ~12 call sites, and the copies drifted:
 * three admin rosters (AdminManager, ServantsAdmin, AlhanAdmin) were still passing
 * `removeClippedSubviews={true}` unconditionally long after the attendance screens
 * had narrowed it to Android, so those three blanked cells on iOS. Nobody noticed
 * because there was no single place where the two variants sat next to each other.
 * That is the bug this module exists to make impossible.
 *
 * Spread it FIRST so a screen's own explicit props still win:
 *
 *   <SectionList
 *     {...LIST_PERF}
 *     {...LIST_KEYBOARD}
 *     removeClippedSubviews={REMOVE_CLIPPED_ANDROID_ONLY}
 *     sections={sections}
 *     …
 *   />
 *
 * ── Why three exports instead of one bundle ───────────────────────────────────
 *
 * This split is deliberate and load-bearing. A single `LIST_DEFAULTS` object would
 * be more convenient and would quietly cause two regressions:
 *
 *  - `LIST_KEYBOARD` is *behavior*, not performance. `keyboardShouldPersistTaps`
 *    changes what a tap does while the keyboard is up. Most of the lists here have
 *    no search field at all, and spreading it onto them would change tap handling
 *    in modals for no benefit. Opt in only where a TextInput sits above the list.
 *
 *  - `REMOVE_CLIPPED_ANDROID_ONLY` is the most dangerous prop in the set — see the
 *    note on it below. Bundling it would turn clipping *on* for every list that
 *    currently omits it, including modal pickers and cards carrying `Animated`
 *    transforms, trading a known iOS bug for a plausible Android one. Keeping it a
 *    separate named import is what lets the iOS fix stay a three-line change.
 *
 * The objects are frozen because they are shared module-level singletons: a screen
 * that mutated one would silently reconfigure every other list in the app.
 */
import { Platform } from "react-native";

/**
 * Pure performance. Safe to spread onto any FlatList/SectionList, including ones
 * that currently pass nothing — the worst case is that fewer rows stay mounted.
 *
 * `windowSize: 7` is the important one. The RN default is 21, i.e. roughly 21
 * screens' worth of rows kept mounted on either side of the viewport; on a church
 * roster that is hundreds of live cells, each with an Avatar subscription. Seven is
 * enough to keep fast scrolling from showing blank space.
 *
 * `updateCellsBatchingPeriod: 50` spaces out the render batches so cell mounting
 * yields to touch handling instead of monopolising the JS thread.
 */
export const LIST_PERF = Object.freeze({
  initialNumToRender: 10,
  maxToRenderPerBatch: 10,
  windowSize: 7,
  updateCellsBatchingPeriod: 50,
});

/**
 * Keyboard handling for lists that sit under a search field.
 *
 * `keyboardShouldPersistTaps: "handled"` lets a row's onPress fire on the first tap
 * while the keyboard is still up, instead of the tap being swallowed to dismiss it.
 * `keyboardDismissMode: "interactive"` lets the keyboard follow the drag.
 *
 * Do NOT spread this onto a list with no text input above it — there is nothing to
 * persist taps through, and it only changes tap semantics.
 */
export const LIST_KEYBOARD = Object.freeze({
  keyboardShouldPersistTaps: "handled",
  keyboardDismissMode: "interactive",
});

/**
 * Android only. On iOS `removeClippedSubviews` has a long history of blanking cells
 * and leaving dead touch targets, which is exactly what it looked like on the three
 * admin rosters that passed `true`: scroll fast to the bottom of Admin Manager and
 * rows came back empty.
 *
 * Note this is intentionally NOT part of `LIST_PERF`. Lists that don't already opt
 * into clipping should keep not opting in — enabling it wholesale on Android risks
 * reproducing the same class of blanking there, particularly in modal pickers and on
 * cards that animate. Only use it where clipping was already intended.
 *
 * One deliberate exception exists in the app and should stay: the drag-reorder list
 * in screens/Settings/HomeScreenSelector.js passes `removeClippedSubviews={false}`,
 * because clipping breaks dragging.
 */
export const REMOVE_CLIPPED_ANDROID_ONLY = Platform.OS === "android";
