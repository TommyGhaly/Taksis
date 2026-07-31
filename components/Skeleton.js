/**
 * Skeleton — shimmer placeholders that replace full-screen spinners.
 *
 * A spinner tells the user "something is happening"; a skeleton tells them
 * *what* is coming and keeps the layout stable so content doesn't jump when it
 * lands. Use the presets at the bottom for the common shapes in this app.
 *
 * Every block sweeps in step off ONE shared, natively-driven clock, and it keeps
 * running for as long as any skeleton is mounted, however busy the JS thread gets.
 * See the long note below for why it is built the way it is; several
 * simpler-looking approaches silently stop or only appear to.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Animated, Easing, AppState } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const BASE = "#1e1e1e";
const HIGHLIGHT = "rgba(255,255,255,0.07)";
const SWEEP_MS = 1300;

/**
 * ONE module-level clock drives every skeleton in the app, and it must keep
 * animating for as long as any skeleton is mounted — through the whole database
 * read — stopping only when the last one unmounts because real data is on screen.
 *
 * ── The sweep geometry, which is where the visible bug was ────────────────────
 *
 * It used to translate a *fixed* 220pt gradient from `-220` to `width + 220`, and
 * `width` fell back to the whole SCREEN width whenever it was a percentage. Blocks
 * clip their children, so on a ~163pt text line the gradient spent ~54% of every
 * cycle entirely outside the box and only ~20% with its bright centre inside; a
 * 48pt avatar was worse, ~10%. Travel distance also varied per block while duration
 * was fixed, so blocks moved at different pixel speeds and never formed one wave.
 *
 * That is an animation which runs perfectly and *looks* stopped — which is why the
 * same defect got reported as "runs once", "pulses 3 times" and "freezes".
 *
 * The fix is to stop guessing: each block measures its own width, sizes the
 * gradient to itself, and travels from `-w` to `+w`. Because the gradient is
 * exactly as wide as the box, some part of it is inside the box for the *entire*
 * cycle — no dark gap — and every block completes one pass per cycle regardless of
 * size, so they all sweep in step.
 *
 * ── Why it is built this way ───────────────────────────────────────────────────
 *
 * Four earlier attempts each died for a different reason, all worth not redoing:
 *
 *  1. A per-provider reanimated `useSharedValue`: several presets nest their own
 *     provider, so an unmounting one cancelled a clock still-mounted blocks read.
 *  2. A module-level reanimated mutable driven by `withRepeat`. `cancelAnimation`
 *     is dispatched to the UI runtime asynchronously while `shared.value = ...`
 *     is a direct write, so a stop queued during a screen handoff could land
 *     *after* the restart and kill the new animation. `withRepeat` also consults
 *     the OS "Reduce Motion" setting by default, which drops the repeat outright.
 *  3. `Animated.loop(..., { iterations: -1 })` alone. The count is read only by
 *     `TimingAnimation.__getNativeAnimationConfig()` — i.e. only by the *native*
 *     driver — but `loop()` routes to `_startNativeLoop()` whenever
 *     `useNativeDriver: true` was merely *requested*. If the native module is
 *     missing RN falls back to the JS driver, which ignores the count and ends
 *     after one pass.
 *  4. Re-arming a single `Animated.timing` from its completion callback.
 *     Driver-agnostic, but the re-arm is a *JS* callback — so when the JS thread
 *     is busy (the entire reason a skeleton is on screen) nothing restarts the
 *     animation until the thread frees up. It stalled exactly when it mattered.
 *
 * So the strategy is chosen up front, because those two mechanisms fail in
 * opposite situations and `Animated.loop` offers no runtime recovery: on the
 * native path it *discards the `start()` callback entirely*, so a completion-based
 * safety net can never fire there.
 *
 *   - Native driver present (effectively always): one `iterations: -1` animation
 *     handed to the native driver. Repeats on the UI thread with zero JS work per
 *     iteration, so it cannot be stalled by a busy JS thread.
 *   - Native driver missing: re-arm from the completion callback. Stalls under
 *     load, but loops — better than freezing after one pass.
 *
 * The probe below reads the same modules RN's own `shouldUseNativeDriver` checks,
 * so it agrees with what RN will actually do.
 */
const nativeDriverAvailable = (() => {
  try {
    // eslint-disable-next-line global-require
    const { TurboModuleRegistry, NativeModules } = require("react-native");
    return Boolean(
      TurboModuleRegistry?.get?.("NativeAnimatedTurboModule") ||
        TurboModuleRegistry?.get?.("NativeAnimatedModule") ||
        NativeModules?.NativeAnimatedTurboModule ||
        NativeModules?.NativeAnimatedModule
    );
  } catch {
    // Inconclusive: assume present. A false positive costs the fallback's
    // stall-resistance; a false negative would cost every skeleton its smoothness.
    return true;
  }
})();

// A plain 0→1 sawtooth. Each block interpolates it into its own pixel range.
const shimmer = new Animated.Value(0);

let liveSkeletons = 0;
let running = false;
let currentSweep = null;
let stopTimer = null;

function startSweep() {
  if (!running) return;

  // Starting a new animation on a value implicitly stops the previous one, but
  // being explicit keeps the AppState re-arm below from ever leaving two loops
  // contending for `shimmer`.
  if (currentSweep) {
    currentSweep.stop();
    currentSweep = null;
  }
  shimmer.setValue(0);

  const timing = Animated.timing(shimmer, {
    toValue: 1,
    duration: SWEEP_MS,
    easing: Easing.linear,
    useNativeDriver: true,
  });

  if (nativeDriverAvailable) {
    // One infinite animation, looped natively. No JS callback per iteration, so a
    // blocked JS thread cannot stall it. Note this must be a bare `timing` —
    // `Animated.sequence` reports `_isUsingNativeDriver: false`, which would send
    // `loop` down its JS `restart()` path and reintroduce failure 4.
    currentSweep = Animated.loop(timing, { iterations: -1 });
    currentSweep.start();
    return;
  }

  currentSweep = timing;
  currentSweep.start(({ finished }) => {
    // `finished` is false when something stopped us (unmount, backgrounding),
    // which is the only way this loop is allowed to end.
    if (finished && running) startSweep();
  });
}

function ensureRunning() {
  // A pending stop from a skeleton that just unmounted is stale the moment a new
  // one mounts — this is what makes screen-to-screen handoffs seamless.
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (running && currentSweep) return;
  running = true;
  startSweep();
}

function scheduleStop() {
  if (stopTimer) return;
  // Deferred a tick so an unmount-then-mount handoff in the same commit never
  // reaches zero. Stopping keeps us from burning frames with nothing on screen.
  stopTimer = setTimeout(() => {
    stopTimer = null;
    // The guard that makes the sweep last exactly as long as the read: it only
    // stops once nothing is mounted, i.e. real data has replaced every skeleton.
    if (liveSkeletons > 0) return;
    running = false;
    if (currentSweep) {
      currentSweep.stop();
      currentSweep = null;
    }
    // Reset so a skeleton mounting later starts its sweep from the left edge.
    shimmer.setValue(0);
  }, 0);
}

// Backgrounding stops in-flight animations with `finished: false`, which would
// otherwise leave a skeleton frozen for the rest of the read. Re-arm on return.
AppState.addEventListener("change", (state) => {
  if (state === "active" && liveSkeletons > 0) {
    running = true;
    startSweep();
  }
});

/**
 * Kept for API compatibility only — the clock is global, so this does nothing.
 * The presets below deliberately no longer wrap themselves in it; it was reading
 * as though it established something. Harmless to call.
 */
export function SkeletonProvider({ children }) {
  return <>{children}</>;
}

/** Ref-counted subscription to the shared clock. */
function useShimmer() {
  useEffect(() => {
    liveSkeletons += 1;
    // Called on every mount, not just the first: any block appearing is enough to
    // guarantee the sweep is running, so no missed start can leave a skeleton
    // sitting frozen.
    ensureRunning();
    return () => {
      liveSkeletons -= 1;
      scheduleStop();
    };
  }, []);

  return shimmer;
}

/**
 * A single shimmering block. Everything else is composed from this.
 *
 * The block measures itself rather than being told its width, because the old
 * guess (`typeof width === "number" ? width : SCREEN_W`) was the whole bug: a
 * percentage-width block was handed the screen width and its gradient spent most
 * of each cycle outside the clipped box.
 *
 * A numeric width is used immediately so fixed-size blocks (avatars, cards) never
 * wait on layout; percentage widths shimmer from the first `onLayout`.
 */
export const SkeletonBlock = React.memo(({
  width = "100%",
  height = 14,
  radius = 8,
  style,
}) => {
  const progress = useShimmer();
  const [measured, setMeasured] = useState(
    typeof width === "number" ? width : 0
  );

  const onLayout = useCallback((e) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0) setMeasured((prev) => (prev === w ? prev : w));
  }, []);

  // Gradient is exactly as wide as the box and travels from `-w` to `+w`, so part
  // of it is always inside the box — a continuous sweep with no dark gap, and one
  // full pass per cycle for every block whatever its size.
  const translateX = useMemo(
    () =>
      measured > 0
        ? progress.interpolate({
            inputRange: [0, 1],
            outputRange: [-measured, measured],
          })
        : null,
    [progress, measured]
  );

  return (
    <View
      onLayout={onLayout}
      style={[
        { width, height, borderRadius: radius, backgroundColor: BASE, overflow: "hidden" },
        style,
      ]}
    >
      {translateX && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
        >
          <LinearGradient
            colors={["transparent", HIGHLIGHT, "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: measured, height: "100%" }}
          />
        </Animated.View>
      )}
    </View>
  );
});
SkeletonBlock.displayName = "SkeletonBlock";

export const SkeletonCircle = React.memo(({ size = 44, style }) => (
  <SkeletonBlock width={size} height={size} radius={size / 2} style={style} />
));
SkeletonCircle.displayName = "SkeletonCircle";

export const SkeletonText = React.memo(({ width = "60%", height = 13, style }) => (
  <SkeletonBlock width={width} height={height} radius={6} style={style} />
));
SkeletonText.displayName = "SkeletonText";

/* ── Presets ──────────────────────────────────────────────────────────────── */

/**
 * A person row: avatar + name + subtitle. Matches the attendance/admin lists.
 *
 * `card` wraps the row in the same dark card the admin rosters use, and `lines`
 * matches its number of text lines — both matter because a skeleton that isn't
 * the same height as the row replacing it makes the list jump on swap.
 */
export const SkeletonPersonRow = React.memo(({ avatarSize = 48, card = false, lines = 2 }) => {
  const widths = ["55%", "32%", "72%"];

  return (
    <View style={[s.row, card && s.rowCard]}>
      <SkeletonCircle size={avatarSize} />
      <View style={s.rowText}>
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonText
            key={i}
            width={widths[i % widths.length]}
            height={i === 0 ? 15 : 12}
            style={i === 0 ? undefined : s.rowTextGap}
          />
        ))}
      </View>
    </View>
  );
});
SkeletonPersonRow.displayName = "SkeletonPersonRow";

/** A list of person rows. */
export const SkeletonPersonList = React.memo(({ count = 8, avatarSize = 48, card = false, lines = 2 }) => (
  <View>
    {Array.from({ length: count }, (_, i) => (
      <SkeletonPersonRow key={i} avatarSize={avatarSize} card={card} lines={lines} />
    ))}
  </View>
));
SkeletonPersonList.displayName = "SkeletonPersonList";

/** Stacked cards — the HomeScreen readings/offerings shape. */
export const SkeletonCardList = React.memo(({ count = 6, height = 56 }) => (
  <View>
    {Array.from({ length: count }, (_, i) => (
      <SkeletonBlock key={i} height={height} radius={14} style={s.card} />
    ))}
  </View>
));
SkeletonCardList.displayName = "SkeletonCardList";

/** A profile header: big avatar, name, a few detail lines. */
export const SkeletonProfile = React.memo(({ avatarSize = 100, lines = 4 }) => (
  <View style={s.profile}>
    <SkeletonCircle size={avatarSize} />
    <SkeletonText width="45%" height={20} style={s.profileName} />
    <View style={s.profileLines}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock key={i} height={52} radius={14} style={s.profileLine} />
      ))}
    </View>
  </View>
));
SkeletonProfile.displayName = "SkeletonProfile";

/**
 * One shimmering block filling the whole screen.
 *
 * Use this when the incoming layout isn't known — the shell, or any container
 * that could render any screen. Inventing card/row shapes there would just be
 * guessing at a layout that won't match what actually loads.
 */
export const SkeletonFullScreen = React.memo(() => (
  <View style={s.fullScreen}>
    <SkeletonBlock width="100%" height="100%" radius={0} />
  </View>
));
SkeletonFullScreen.displayName = "SkeletonFullScreen";

/**
 * Whole-screen placeholder: optional title bar then a body of rows or cards.
 * This is the drop-in replacement for `if (loading) return <ActivityIndicator/>`.
 *
 * Only use a shaped variant when you actually know the layout that's coming;
 * otherwise use `variant="block"`.
 */
export const SkeletonScreen = React.memo(({
  variant = "list",
  count = 8,
  showHeader = true,
  // Pass the host screen's own gutters so nothing shifts sideways or vertically
  // on swap — a skeleton in a different box than the content it replaces reads
  // as a jump even when the shapes are right.
  paddingHorizontal = 20,
  paddingTop = 24,
  // Extra style for the row body, for screens whose list has its own insets
  // (e.g. paddingRight to clear an alphabet index bar).
  bodyStyle,
  // The screen's real header JSX. Rendering the actual chrome — rather than
  // shimmering a guess at it — means the header doesn't move when data lands.
  header,
  rowLines,
  avatarSize,
}) => {
  if (variant === "block") return <SkeletonFullScreen />;

  return (
    <View style={[s.screen, { paddingHorizontal, paddingTop }]}>
        {header}
        {showHeader && !header && (
          <View style={s.header}>
            <SkeletonText width="52%" height={26} />
            <SkeletonText width="34%" height={14} style={{ marginTop: 10 }} />
          </View>
        )}
        <View style={bodyStyle}>
          {variant === "list" &&
            Array.from({ length: count }, (_, i) => <SkeletonPersonRow key={i} />)}
          {variant === "personCards" &&
            Array.from({ length: count }, (_, i) => (
              <SkeletonPersonRow key={i} card lines={rowLines ?? 2} />
            ))}
          {variant === "cards" &&
            Array.from({ length: count }, (_, i) => (
              <SkeletonBlock key={i} height={56} radius={14} style={s.card} />
            ))}
          {variant === "profile" && (
            <SkeletonProfile
              {...(avatarSize != null ? { avatarSize } : null)}
              {...(rowLines != null ? { lines: rowLines } : null)}
            />
          )}
      </View>
    </View>
  );
});
SkeletonScreen.displayName = "SkeletonScreen";

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#121212" },
  // Was referenced by SkeletonFullScreen but never defined, so the wrapper had no
  // dimensions and its `height: "100%"` child collapsed to nothing — the `block`
  // variant rendered empty.
  fullScreen: { flex: 1, backgroundColor: "#121212" },
  header: { marginBottom: 26 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  // Mirrors the admin roster card: same radius, padding and gap.
  rowCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 16,
    marginBottom: 12,
  },
  rowText: { flex: 1, marginLeft: 14 },
  // Hoisted out of the JSX: fresh object literals every render were defeating
  // React.memo on the children they were passed to.
  rowTextGap: { marginTop: 8 },
  card: { marginBottom: 12 },
  profile: { alignItems: "center", paddingTop: 20 },
  profileName: { marginTop: 16 },
  profileLines: { width: "100%", marginTop: 28 },
  profileLine: { marginBottom: 10 },
});

export default SkeletonScreen;
