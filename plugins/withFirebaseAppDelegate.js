const { IOSConfig, withDangerousMod } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const fs = require('fs');

// @react-native-firebase/app's own config plugin anchors its Swift insertion on
// `self.moduleName = "..."`, which the Expo SDK 53 / RN 0.79 AppDelegate no
// longer has — it uses ExpoReactNativeFactory and passes the module name as an
// argument to startReactNative instead. The Swift path has no fallback matcher,
// so the plugin adds `import FirebaseCore` and then warns:
//
//   Unable to determine correct Firebase insertion point in AppDelegate.swift.
//
// leaving the app with the import but no FirebaseApp.configure() call, which
// crashes at runtime on first Firebase access. reset-ios.sh has been patching
// this in with sed, but that only helps locally — a bare `expo prebuild` (CI,
// EAS Build, a fresh clone) still produces a broken AppDelegate.
//
// This plugin does the insertion as part of prebuild instead. Anchor is
// `bindReactNativeFactory(factory)`: the last line of factory setup before
// React Native starts, and the same anchor the sed patch already proved works.
const ANCHOR = /bindReactNativeFactory\(factory\)/g;
const TAG = 'withFirebaseAppDelegate-configure';

function withFirebaseAppDelegate(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const { path, contents, language } = IOSConfig.Paths.getAppDelegate(
        config.modRequest.projectRoot
      );

      if (language !== 'swift') {
        throw new Error(
          `withFirebaseAppDelegate expects a Swift AppDelegate, got "${language}". ` +
            `Remove this plugin or update it for the new template.`
        );
      }

      let newContents = contents;

      if (!newContents.includes('import FirebaseCore')) {
        newContents = newContents.replace(
          /import Expo/,
          'import Expo\nimport FirebaseCore'
        );
      }

      // The upstream plugin may have already inserted the call (if a future
      // version fixes its matcher), and reset-ios.sh's sed patch may have too.
      // Either way, don't add a second one.
      if (newContents.includes('FirebaseApp.configure()')) {
        if (newContents !== contents) {
          await fs.promises.writeFile(path, newContents);
        }
        return config;
      }

      if (!ANCHOR.test(newContents)) {
        throw new Error(
          `withFirebaseAppDelegate: anchor "bindReactNativeFactory(factory)" not found in ${path}. ` +
            `The Expo AppDelegate template likely changed — update the anchor in ` +
            `plugins/withFirebaseAppDelegate.js.`
        );
      }

      newContents = mergeContents({
        tag: TAG,
        src: newContents,
        newSrc: '    FirebaseApp.configure()',
        anchor: ANCHOR,
        offset: 1, // insert on the line below the anchor
        comment: '//',
      }).contents;

      await fs.promises.writeFile(path, newContents);
      return config;
    },
  ]);
}

module.exports = withFirebaseAppDelegate;
