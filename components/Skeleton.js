/**
 * Skeleton — shimmer placeholders that replace full-screen spinners.
 *
 * A spinner tells the user "something is happening"; a skeleton tells them
 * *what* is coming and keeps the layout stable so content doesn't jump when it
 * lands. Use the presets at the bottom for the common shapes in this app.
 *
 * One shared, natively-driven clock drives every shimmer on screen, so adding
 * more skeletons costs no extra animation work.
 */
import React, { useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  AppState,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_W } = Dimensions.get("window");

const BASE = "#1e1e1e";
const HIGHLIGHT = "rgba(255,255,255,0.07)";
const SWEEP_MS = 1300;
const SWEEP_W = 220;

/**
 * ONE module-level clock drives every shimmer in the app, and it must keep
 * sweeping for as long as any skeleton is mounted — through the whole database
 * read — stopping only when the last one unmounts because real data is on
 * screen.
 *
 * Getting that to actually hold took ruling out three ways the sweep can die:
 *
 *  1. A per-provider reanimated `useSharedValue`: several presets nest their own
 *     provider inside SkeletonScreen's, so an unmounting provider cancelled a
 *     clock that other, still-mounted blocks were reading.
 *  2. A module-level reanimated mutable driven by `withRepeat`. `cancelAnimation`
 *     is dispatched to the UI runtime asynchronously while `shared.value = ...`
 *     is a direct write, so a stop queued during a screen handoff could land
 *     *after* the restart and kill the new animation. `withRepeat` also consults
 *     the OS "Reduce Motion" setting by default, which drops the repeat outright.
 *  3. `Animated.loop(..., { iterations: -1 })`. The iteration count is only read
 *     by `TimingAnimation.__getNativeAnimationConfig()` — that is, only by the
 *     *native* driver. `loop()` routes to `_startNativeLoop()` whenever
 *     `useNativeDriver: true` was requested, but if the native animated module
 *     isn't available RN warns and quietly falls back to the JS driver, whose
 *     `onUpdate` ends after a single pass and never looks at the count. Result:
 *     a handful of sweeps (or one) and then a frozen skeleton.
 *
 * So the loop is re-armed from the completion callback instead of trusting any
 * iteration count — that behaves identically under either driver. It costs one
 * JS callback per sweep (~0.8/sec) for the whole app, and the interpolation
 * still runs natively.
 */
const shimmer = new Animated.Value(0);
let liveSkeletons = 0;
let running = false;
let currentSweep = null;
let stopTimer = null;

function sweep() {
  if (!running) return;
  shimmer.setValue(0);
  currentSweep = Animated.timing(shimmer, {
    toValue: 1,
    duration: SWEEP_MS,
    easing: Easing.linear,
    useNativeDriver: true,
  });
  currentSweep.start(({ finished }) => {
    // `finished` is false when something stopped us (unmount, backgrounding),
    // which is the only way this loop is allowed to end.
    if (finished && running) sweep();
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
  sweep();
}

function scheduleStop() {
  if (stopTimer) return;
  // Deferred a tick so an unmount-then-mount handoff in the same commit never
  // reaches zero. Stopping keeps us from burning frames with nothing on screen.
  stopTimer = setTimeout(() => {
    stopTimer = null;
    if (liveSkeletons > 0) return;
    running = false;
    if (currentSweep) {
      currentSweep.stop();
      currentSweep = null;
    }
  }, 0);
}

// Backgrounding stops in-flight animations with `finished: false`, which would
// otherwise leave a skeleton frozen for the rest of the read. Re-arm on return.
AppState.addEventListener("change", (state) => {
  if (state === "active" && liveSkeletons > 0) {
    running = true;
    sweep();
  }
});

/**
 * Kept for API compatibility — the clock is global now, so this is just a
 * passthrough. Nesting it is harmless.
 */
export function SkeletonProvider({ children }) {
  return <>{children}</>;
}

/** Ref-counted subscription to the shared clock. */
function useShimmer() {
  useEffect(() => {
    liveSkeletons += 1;
    // Called on every mount, not just the first: any block appearing is enough
    // to guarantee the sweep is running, so no missed start can leave a skeleton
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
 */
export const SkeletonBlock = React.memo(({
  width = "100%",
  height = 14,
  radius = 8,
  style,
}) => {
  const progress = useShimmer();

  // One interpolation node per block off the shared value. Percentage widths
  // can't be measured here, so they sweep the screen width.
  const translateX = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [
          -SWEEP_W,
          (typeof width === "number" ? width : SCREEN_W) + SWEEP_W,
        ],
      }),
    [progress, width]
  );

  return (
    <View
      style={[
        { width, height, borderRadius: radius, backgroundColor: BASE, overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
      >
        <LinearGradient
          colors={["transparent", HIGHLIGHT, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: SWEEP_W, height: "100%" }}
        />
      </Animated.View>
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
            style={i === 0 ? undefined : { marginTop: 8 }}
          />
        ))}
      </View>
    </View>
  );
});
SkeletonPersonRow.displayName = "SkeletonPersonRow";

/** A list of person rows. */
export const SkeletonPersonList = React.memo(({ count = 8, avatarSize = 48, card = false, lines = 2 }) => (
  <SkeletonProvider>
    <View>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonPersonRow key={i} avatarSize={avatarSize} card={card} lines={lines} />
      ))}
    </View>
  </SkeletonProvider>
));
SkeletonPersonList.displayName = "SkeletonPersonList";

/** Stacked cards — the HomeScreen readings/offerings shape. */
export const SkeletonCardList = React.memo(({ count = 6, height = 56 }) => (
  <SkeletonProvider>
    <View>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} height={height} radius={14} style={s.card} />
      ))}
    </View>
  </SkeletonProvider>
));
SkeletonCardList.displayName = "SkeletonCardList";

/** A profile header: big avatar, name, a few detail lines. */
export const SkeletonProfile = React.memo(({ avatarSize = 100, lines = 4 }) => (
  <SkeletonProvider>
    <View style={s.profile}>
      <SkeletonCircle size={avatarSize} />
      <SkeletonText width="45%" height={20} style={{ marginTop: 16 }} />
      <View style={s.profileLines}>
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonBlock key={i} height={52} radius={14} style={{ marginBottom: 10 }} />
        ))}
      </View>
    </View>
  </SkeletonProvider>
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
  <SkeletonProvider>
    <View style={s.fullScreen}>
      <SkeletonBlock width="100%" height="100%" radius={0} />
    </View>
  </SkeletonProvider>
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
    <SkeletonProvider>
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
    </SkeletonProvider>
  );
});
SkeletonScreen.displayName = "SkeletonScreen";

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#121212" },
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
    paddingVertical: 16,
    marginBottom: 12,
  },
  rowText: { flex: 1, marginLeft: 14 },
  card: { marginBottom: 12 },
  profile: { alignItems: "center", paddingTop: 20 },
  profileLines: { width: "100%", marginTop: 28 },
});

export default SkeletonScreen;
