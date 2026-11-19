/**
 * Expo config plugin that moves the iOS app onto the UIScene life cycle.
 *
 * Apps linked against the iOS 27 SDK must adopt scenes. Without a
 * `UIApplicationSceneManifest`, UIKit traps at launch in
 * `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` — an
 * EXC_BREAKPOINT before a single line of JS runs. Expo's SDK 54 template
 * predates that rule (scene support landed in SDK 58 as `ExpoAppSceneDelegate`),
 * so a project archived with Xcode 27 builds cleanly and dies on launch.
 *
 * This is a backport of SDK 58's `ExpoAppSceneDelegate`, adapted to SDK 54:
 *
 *   1. Info.plist gets a single-scene manifest pointing at `SceneDelegate`.
 *   2. A `SceneDelegate` class is appended to AppDelegate.swift (kept in the
 *      same file so no pbxproj surgery is needed).
 *   3. Where React Native starts depends on the build:
 *      - Release: the scene delegate creates the window from the connecting
 *        scene and starts React Native there, rebuilding the launch options
 *        so `Linking.getInitialURL()` still sees a link that cold-starts the
 *        app (under scenes UIKit no longer puts it in launch options).
 *      - Debug: expo-dev-launcher (SDK 54) throws unless React Native has been
 *        started before `super.application(_:didFinishLaunchingWithOptions:)`,
 *        so the app delegate keeps starting it as before and the scene
 *        delegate only hands that existing window to the scene.
 *   4. Scene events (URLs, universal links, foreground/background) are
 *      forwarded to the app delegate, because UIKit stops calling the app
 *      delegate versions once scenes are adopted. Forwarding through the
 *      Objective-C protocol keeps Expo subscribers, RCTLinkingManager and any
 *      swizzled handlers (Firebase, Google Sign-In) receiving them exactly as
 *      before.
 *
 * Delete this plugin when upgrading to Expo SDK 58+, whose template ships its
 * own SceneDelegate.
 */

const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

const MARKER = "class SceneDelegate: UIResponder, UIWindowSceneDelegate";

// The window + startReactNative block from Expo 54's AppDelegate template.
const START_BLOCK =
  /#if os\(iOS\) \|\| os\(tvOS\)\n([ \t]*)window = UIWindow\(frame: UIScreen\.main\.bounds\)\n[ \t]*factory\.startReactNative\(\n[ \t]*withModuleName: "main",\n[ \t]*in: window,\n[ \t]*launchOptions: launchOptions\)\n#endif/;

const SCENE_DELEGATE = `
// MARK: - Scene life cycle (plugins/withSceneLifecycle.js)

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var app: UIApplication { UIApplication.shared }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = app.delegate as? AppDelegate else {
      return
    }

#if DEBUG
    // React Native was already started into this window by the app delegate
    // (expo-dev-launcher requires that order); give it to the scene to show.
    let window = appDelegate.window ?? UIWindow()
    window.windowScene = windowScene
    window.frame = windowScene.coordinateSpace.bounds
    window.makeKeyAndVisible()
#else
    let window = UIWindow(windowScene: windowScene)
    // Code such as expo-system-ui reads UIApplication.shared.delegate?.window.
    appDelegate.window = window
    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: Self.launchOptions(from: connectionOptions))
#endif
    self.window = window

    // Cold-start links: deliver them to the same handlers a warm link reaches.
    for context in connectionOptions.urlContexts {
      _ = app.delegate?.application?(app, open: context.url, options: Self.openURLOptions(from: context.options))
    }
    for activity in connectionOptions.userActivities {
      _ = app.delegate?.application?(app, continue: activity, restorationHandler: { _ in })
    }
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    app.delegate?.applicationDidBecomeActive?(app)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    app.delegate?.applicationWillResignActive?(app)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    app.delegate?.applicationWillEnterForeground?(app)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    app.delegate?.applicationDidEnterBackground?(app)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = app.delegate?.application?(app, open: context.url, options: Self.openURLOptions(from: context.options))
    }
  }

  func scene(_ scene: UIScene, willContinueUserActivityWithType userActivityType: String) {
    _ = app.delegate?.application?(app, willContinueUserActivityWithType: userActivityType)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = app.delegate?.application?(app, continue: userActivity, restorationHandler: { _ in })
  }

  func scene(_ scene: UIScene, didFailToContinueUserActivityWithType userActivityType: String, error: Error) {
    app.delegate?.application?(app, didFailToContinueUserActivityWithType: userActivityType, error: error)
  }

  func scene(_ scene: UIScene, didUpdate userActivity: NSUserActivity) {
    app.delegate?.application?(app, didUpdate: userActivity)
  }

  /// Rebuilds the launch options \`Linking.getInitialURL()\` reads. Under scenes
  /// UIKit delivers the cold-start URL or universal link in the connection
  /// options instead. Keys are spelled out because the UIApplication accessors
  /// are deprecated, but React Native still reads these exact strings.
  static func launchOptions(from options: UIScene.ConnectionOptions) -> [UIApplication.LaunchOptionsKey: Any]? {
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = options.urlContexts.first?.url {
      launchOptions[UIApplication.LaunchOptionsKey(rawValue: "UIApplicationLaunchOptionsURLKey")] = url
    }
    if let activity = options.userActivities.first(where: { $0.activityType == NSUserActivityTypeBrowsingWeb }) {
      launchOptions[UIApplication.LaunchOptionsKey(rawValue: "UIApplicationLaunchOptionsUserActivityDictionaryKey")] = [
        "UIApplicationLaunchOptionsUserActivityTypeKey": activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }
    return launchOptions.isEmpty ? nil : launchOptions
  }

  static func openURLOptions(from options: UIScene.OpenURLOptions) -> [UIApplication.OpenURLOptionsKey: Any] {
    var result: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: options.openInPlace]
    if let sourceApplication = options.sourceApplication {
      result[.sourceApplication] = sourceApplication
    }
    if let annotation = options.annotation {
      result[.annotation] = annotation
    }
    return result
  }
}
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    const { contents, language } = cfg.modResults;

    if (language !== "swift") {
      throw new Error(
        `[withSceneLifecycle] Expected a Swift AppDelegate, got '${language}'.`
      );
    }

    if (contents.includes(MARKER)) return cfg;

    if (!START_BLOCK.test(contents)) {
      throw new Error(
        "[withSceneLifecycle] Could not find Expo's window/startReactNative block in " +
          "AppDelegate.swift. Expo's template changed. If the template now has its own " +
          "SceneDelegate (SDK 58+), delete this plugin; otherwise fix the pattern. Without " +
          "it, an app built with the iOS 27 SDK crashes at launch."
      );
    }

    const startOnlyInDebug = contents.replace(START_BLOCK, (block, indent) =>
      [
        "#if DEBUG",
        `${indent}// expo-dev-launcher needs React Native started before super's`,
        `${indent}// didFinishLaunching; SceneDelegate attaches this window to the scene.`,
        `${indent}// Release builds start React Native from SceneDelegate instead.`,
        block.replace(/^#if os\(iOS\) \|\| os\(tvOS\)\n/, "").replace(/\n#endif$/, ""),
        "#endif",
      ].join("\n")
    );

    cfg.modResults.contents = `${startOnlyInDebug.trimEnd()}\n${SCENE_DELEGATE}`;
    return cfg;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneDelegate(withSceneManifest(config));
};
