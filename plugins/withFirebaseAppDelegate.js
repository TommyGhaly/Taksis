/**
 * Expo config plugin that adds `FirebaseApp.configure()` to the AppDelegate.
 *
 * `@react-native-firebase/app`'s own plugin gives up on this project:
 *
 *   » ios: @react-native-firebase/app: Unable to determine correct Firebase
 *     insertion point in AppDelegate.swift. Skipping Firebase addition.
 *
 * It still adds `import FirebaseCore`, so the omission is easy to miss — the app
 * compiles, links, and archives cleanly, then fails at runtime the moment
 * anything touches Firestore or Auth. Which is everything.
 *
 * This used to be patched by `reset-ios.sh` with sed. That covered local resets
 * but not `expo prebuild` on its own, so a prebuild outside that script produced
 * a project that built and was broken.
 *
 * Inserted immediately after `bindReactNativeFactory(factory)`, which is the
 * last line of Expo's React Native setup before the window is created, so
 * Firebase is configured before any JS can run.
 */

const { withAppDelegate } = require("@expo/config-plugins");

const ANCHOR = "bindReactNativeFactory(factory)";
const CALL = "FirebaseApp.configure()";

module.exports = function withFirebaseAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    const { contents, language } = cfg.modResults;

    if (language !== "swift") {
      throw new Error(
        `[withFirebaseAppDelegate] Expected a Swift AppDelegate, got '${language}'.`
      );
    }

    if (contents.includes(CALL)) return cfg;

    if (!contents.includes(ANCHOR)) {
      throw new Error(
        `[withFirebaseAppDelegate] Could not find '${ANCHOR}' in AppDelegate.swift. ` +
          "Expo's template changed. Fix this plugin rather than removing it: without " +
          "the call the app builds fine and then fails at runtime on the first " +
          "Firestore or Auth access."
      );
    }

    // Match the anchor's indentation so the result reads like hand-written code.
    const indented = contents.replace(
      new RegExp(`^([ \\t]*)${ANCHOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"),
      (line, indent) => `${line}\n${indent}${CALL}`
    );

    if (indented === contents) {
      throw new Error(
        "[withFirebaseAppDelegate] Found the anchor but failed to insert after it."
      );
    }

    cfg.modResults.contents = indented;
    return cfg;
  });
};
