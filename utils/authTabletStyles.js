import { Dimensions, Platform } from "react-native";

// Device-level check (never changes on rotation), so phones always take the
// untouched phone path in the auth screens.
const screen = Dimensions.get("screen");
export const IS_TABLET =
  Platform.isPad || Math.min(screen.width, screen.height) >= 600;

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const r = (n) => Math.round(n);

/**
 * Tablet-only style overrides for SignIn / SignUp.
 *
 * The phone styles scale everything off `width / 375`, which on a tablet
 * blows the type and controls up ~2.2x and stretches the form edge to edge.
 * Here the content is instead capped to a centered column and the type is
 * scaled off the window's shortest side, so portrait and landscape agree.
 *
 * Takes live window dimensions so rotation (and iPad multitasking) re-lays out.
 */
export const makeAuthTabletStyles = (winW, winH) => {
  const landscape = winW > winH;
  // Shortest side is orientation-invariant, so the card keeps the same size
  // and type scale when the device rotates.
  const k = clamp(Math.min(winW, winH) / 700, 1, 1.35);
  const gutter = 32 * k;
  const card = Math.min(winW - gutter * 2, 560 * k);
  const sidePad = Math.max((winW - card) / 2, gutter);
  // Landscape has far less height to spend; tighten the vertical rhythm and
  // the screen padding so the form still fits without scrolling.
  const v = landscape ? 0.6 : 1;
  const vPad = landscape ? 0.45 : 1;
  // Control heights come down a touch in landscape (still well over the 44pt
  // touch target) so the four-field sign-up form clears the fold.
  const c = landscape ? 0.92 : 1;
  const iconW = Math.min(card * 0.5, 300 * k) * (landscape ? 0.7 : 1);

  return {
    k,
    backArrowSize: r(26 * k),

    scrollContent: {
      paddingHorizontal: sidePad,
      paddingTop: r(36 * k * vPad),
      paddingBottom: r(36 * k * vPad),
      justifyContent: "center",
    },
    backArrowContainer: { marginBottom: r(20 * k * v) },
    progressBarContainer: {
      height: r(6 * k),
      borderRadius: r(3 * k),
      marginBottom: r(28 * k * v),
    },

    heading: { marginBottom: r(26 * k * v) },
    icon: {
      width: iconW,
      height: iconW * (499 / 1089),
      marginBottom: r(20 * k * v),
    },
    title: { fontSize: r(34 * k), lineHeight: r(41 * k) },
    subtitle: {
      fontSize: r(16 * k),
      marginTop: r(8 * k),
      lineHeight: r(22 * k),
    },

    form: { marginBottom: r(6 * k) },
    fieldWrap: { marginBottom: r(14 * k * (landscape ? 0.8 : 1)) },
    inputWrap: {
      height: r(62 * k * c),
      borderRadius: r(14 * k),
      paddingHorizontal: r(16 * k),
      paddingTop: r(15 * k),
    },
    input: { fontSize: r(16 * k), paddingTop: r(9 * k) },
    labelLeft: r(16 * k),
    labelTop: [r(18 * k), r(7 * k)],
    labelFont: [r(16 * k), r(12 * k)],
    eyeSize: r(22 * k),
    eyeBtn: { padding: r(4 * k), marginLeft: r(6 * k) },

    errorRow: { marginTop: r(5 * k), marginLeft: r(4 * k), gap: r(5 * k) },
    errorText: { fontSize: r(13 * k) },
    errorIconSize: r(13 * k),

    strengthRow: {
      gap: r(7 * k),
      marginTop: r(-2 * k),
      marginBottom: r(12 * k),
      paddingHorizontal: r(2 * k),
    },
    strengthBar: { height: r(5 * k), borderRadius: r(2.5 * k) },
    strengthLabel: {
      fontSize: r(12 * k),
      marginLeft: r(9 * k),
      minWidth: r(56 * k),
    },

    forgotRow: { marginTop: r(6 * k), marginBottom: r(22 * k * v) },
    forgotText: { fontSize: r(15 * k) },

    continueButton: {
      height: r(56 * k * c),
      borderRadius: r(14 * k),
      gap: r(10 * k),
      marginBottom: r(22 * k * v),
    },
    // SignUp's button sits straight under the last field and needs the gap.
    continueButtonSpaced: { marginTop: r(14 * k * v) },
    continueText: { fontSize: r(17 * k) },
    continueIconSize: r(20 * k),

    dividerContainer: { marginBottom: r(18 * k * v) },
    orText: { marginHorizontal: r(14 * k), fontSize: r(13 * k) },

    socialRow: { gap: r(12 * k), marginBottom: r(26 * k * v) },
    socialButton: { height: r(70 * k * c), borderRadius: r(16 * k), gap: r(6 * k) },
    socialIconWrap: { height: r(28 * k) },
    socialIconSize: r(28 * k),
    socialLabel: { fontSize: r(12 * k) },
    googleIcon: { width: r(26 * k), height: r(26 * k) },

    // Cancels the phone layout's `marginTop: "auto"` so the whole stack can
    // sit centered instead of being pinned to the bottom of a tall screen.
    footerRow: { marginTop: r(6 * k), paddingTop: r(14 * k), gap: r(7 * k) },
    footerText: { fontSize: r(15 * k) },
  };
};
