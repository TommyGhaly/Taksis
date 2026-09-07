/**
 * Expo config plugin that adds the Taksis App Clip target to the generated
 * Xcode project.
 *
 * `ios/` is generated output — anything added by hand in Xcode is destroyed by
 * the next `expo prebuild --clean`. This plugin re-creates the target from the
 * Swift sources checked into `ios-appclip/`, so the clip survives regeneration
 * and CI/EAS builds it without manual steps.
 *
 * The clip is pure SwiftUI and links no pods. That is deliberate: App Clips have
 * a hard uncompressed size budget (15 MB on iOS 16+), which React Native and the
 * Firebase SDK cannot fit inside. The clip talks to Firestore over REST instead.
 */

const {
  withXcodeProject,
  withEntitlementsPlist,
  withDangerousMod,
} = require("@expo/config-plugins");
const plist = require("@expo/plist").default;
const fs = require("fs");
const path = require("path");

// ── Configuration ───────────────────────────────────────────────────────────
const TARGET_NAME = "TaksisClip";
const SOURCE_DIR = "ios-appclip/TaksisClip";
const DEPLOYMENT_TARGET = "16.0";

/**
 * Suffix appended to the app's bundle identifier to form the clip's, giving
 * `com.tghaly.taksis.Clip`. Apple requires the clip's ID to be the parent app's
 * ID plus exactly one additional component.
 *
 * Deliberately not named after a snippet. iOS allows exactly one App Clip target
 * per app, so this single binary serves every App Clip Experience — naming it
 * `register-vehicle` would be wrong the moment a second snippet ships, and bundle
 * identifiers cannot be changed once registered in App Store Connect.
 *
 * Capitalised because this App ID is **already registered** in the developer
 * account, with a provisioning profile carrying `on-demand-install-capable` and
 * the parent-app entitlement. Bundle identifiers are case-sensitive: lowercasing
 * this fails to match the profile and the device build dies with "No profiles for
 * 'com.tghaly.taksis.clip' were found". Do not tidy the capitalisation.
 */
const BUNDLE_ID_SUFFIX = "Clip";

/**
 * Domain that serves the App Clip experiences and the
 * `.well-known/apple-app-site-association` file.
 *
 * **This is the only place the domain is written.** The clip's entitlements are
 * rewritten from it during prebuild, so the two cannot drift — a mismatch
 * between them produces no build error, just a clip that refuses to launch.
 *
 * Whatever you set here must serve `/.well-known/apple-app-site-association`
 * over HTTPS with no redirects, listing this app's Team ID and the clip's bundle
 * identifier. Change it here, deploy the AASA to the new host, and use the same
 * domain when registering the App Clip Experience.
 *
 * The apex is served by Firebase Hosting rather than Wix precisely because of the
 * no-redirect rule: Wix answered `/.well-known/*` with a 301 to www and then a
 * 400, which Apple treats as no AASA at all. The church site itself still lives on
 * Wix at `www.spsmwayland.org`; see the `redirects` block in `firebase.json`.
 */
const ASSOCIATED_DOMAIN = "spsmwayland.org";

/**
 * Snippet the generated scheme launches into.
 *
 * Xcode stores the App Clip invocation URL as a `_XCAppClipURL` environment
 * variable on the scheme's Run action, which is exactly what
 * `ClipRouter.resolveDebugEnvironment()` reads. Setting it here means a fresh
 * checkout can select the scheme and hit Run without configuring anything.
 */
const DEBUG_INVOCATION_URL = `https://${ASSOCIATED_DOMAIN}/c/register-vehicle`;

const SWIFT_FILES = [
  "TaksisClipApp.swift",
  "RootView.swift",
  "ClipRouter.swift",
  "ClipDestination.swift",
  "RegisterVehicleView.swift",
  "RegistrationModel.swift",
  "FormComponents.swift",
  "FlowLayout.swift",
  "Theme.swift",
  "FirestoreREST.swift",
  "ClipConfig.swift",
];

const RESOURCE_FILES = ["Assets.xcassets"];
// Referenced by build settings rather than compiled, so they belong in the
// group but not in a build phase.
const REFERENCE_ONLY_FILES = ["Info.plist", `${TARGET_NAME}.entitlements`];

// ── Step 1: copy the checked-in sources into ios/ ───────────────────────────

const withClipSources = (config) =>
  withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const src = path.join(projectRoot, SOURCE_DIR);
      const dest = path.join(cfg.modRequest.platformProjectRoot, TARGET_NAME);

      if (!fs.existsSync(src)) {
        throw new Error(
          `[withVehicleAppClip] Expected App Clip sources at ${SOURCE_DIR}, but that directory does not exist.`
        );
      }

      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(src, dest, { recursive: true });

      // Stamp the domain in from ASSOCIATED_DOMAIN so the checked-in
      // entitlements cannot disagree with it.
      const entitlementsPath = path.join(dest, `${TARGET_NAME}.entitlements`);
      const entitlements = plist.parse(fs.readFileSync(entitlementsPath, "utf8"));
      entitlements["com.apple.developer.associated-domains"] = [
        `appclips:${ASSOCIATED_DOMAIN}`,
      ];
      fs.writeFileSync(entitlementsPath, plist.build(entitlements));

      return cfg;
    },
  ]);

// ── Step 2: let installed-app users open the same links ─────────────────────

const withParentAssociatedDomains = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    const existing = cfg.modResults["com.apple.developer.associated-domains"] || [];
    const needed = [
      `appclips:${ASSOCIATED_DOMAIN}`,
      `applinks:${ASSOCIATED_DOMAIN}`,
    ];
    cfg.modResults["com.apple.developer.associated-domains"] = Array.from(
      new Set([...existing, ...needed])
    );
    return cfg;
  });

// ── Step 3: create the target in the pbxproj ────────────────────────────────

const withClipTarget = (config) =>
  withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;

    // prebuild can run the mod more than once; adding the target twice
    // produces a project Xcode refuses to open.
    const existing = findTargetByName(proj, TARGET_NAME);
    if (existing) {
      writeClipScheme(cfg, existing);
      return cfg;
    }

    const clipBundleId = `${cfg.ios.bundleIdentifier}.${BUNDLE_ID_SUFFIX}`;

    // `xcode` has no product type for App Clips, so create an application
    // target and correct the product type below.
    const target = proj.addTarget(TARGET_NAME, "application", TARGET_NAME, clipBundleId);
    proj.pbxNativeTargetSection()[target.uuid].productType =
      '"com.apple.product-type.application.on-demand-install-capable"';

    // addTarget does not create build phases.
    proj.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", target.uuid);
    proj.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);
    proj.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);

    // Group holding the clip's files, nested under the project root group.
    const group = proj.addPbxGroup([], TARGET_NAME, TARGET_NAME);
    const mainGroupId = proj.getFirstProject().firstProject.mainGroup;
    proj.addToPbxGroup(group.uuid, mainGroupId);

    for (const file of SWIFT_FILES) {
      proj.addSourceFile(file, { target: target.uuid }, group.uuid);
    }
    for (const file of RESOURCE_FILES) {
      addResourceFile(proj, file, group.uuid, target.uuid);
    }
    for (const file of REFERENCE_ONLY_FILES) {
      proj.addFile(file, group.uuid, { lastKnownFileType: "text.plist.xml" });
    }

    applyBuildSettings(proj, target, cfg, clipBundleId);
    embedIntoMainApp(proj, target, cfg);
    writeClipScheme(cfg, target.uuid);

    return cfg;
  });

/**
 * Adds a resource to the clip's Resources phase.
 *
 * `xcode`'s own `addResourceFile` cannot be used here: it calls
 * `correctForResourcesPath`, which dereferences a group literally named
 * "Resources". Expo-generated projects have no such group, so that path throws.
 * This does the same work without the lookup.
 */
function addResourceFile(proj, filename, groupId, targetId) {
  const file = proj.addFile(filename, groupId, {
    lastKnownFileType: "folder.assetcatalog",
  });
  if (!file) return;

  file.uuid = proj.generateUuid();
  file.target = targetId;

  proj.addToPbxBuildFileSection(file);
  proj.addToPbxResourcesBuildPhase(file);
}

function findTargetByName(proj, name) {
  const targets = proj.pbxNativeTargetSection();
  return Object.keys(targets).find(
    (key) =>
      !key.endsWith("_comment") &&
      stripQuotes(targets[key].name) === name
  );
}

function stripQuotes(value) {
  return typeof value === "string" ? value.replace(/^"|"$/g, "") : value;
}

function applyBuildSettings(proj, target, cfg, clipBundleId) {
  const teamId = cfg.ios?.appleTeamId;
  if (!teamId) {
    throw new Error(
      "[withVehicleAppClip] ios.appleTeamId is missing from the Expo config. " +
        "The App Clip target needs it to sign for a device."
    );
  }

  const configurations = proj.pbxXCBuildConfigurationSection();
  const listId = proj.pbxNativeTargetSection()[target.uuid].buildConfigurationList;
  const configList = proj.pbxXCConfigurationList()[listId];

  for (const { value: configId } of configList.buildConfigurations) {
    const settings = configurations[configId].buildSettings;

    Object.assign(settings, {
      PRODUCT_NAME: `"${TARGET_NAME}"`,
      // Build settings are per-target and this one is not inherited from the app
      // target, so omitting it fails a device build with "Signing for
      // TaksisClip requires a development team" -- which reads like a project
      // misconfiguration rather than a missing setting.
      DEVELOPMENT_TEAM: teamId,
      PRODUCT_BUNDLE_IDENTIFIER: `"${clipBundleId}"`,
      INFOPLIST_FILE: `"${TARGET_NAME}/Info.plist"`,
      GENERATE_INFOPLIST_FILE: "NO",
      CODE_SIGN_ENTITLEMENTS: `"${TARGET_NAME}/${TARGET_NAME}.entitlements"`,
      CODE_SIGN_STYLE: "Automatic",
      IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
      SWIFT_VERSION: "5.0",
      TARGETED_DEVICE_FAMILY: '"1,2"',
      ASSETCATALOG_COMPILER_APPICON_NAME: "AppIcon",
      ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: '""',
      MARKETING_VERSION: `"${cfg.version ?? "1.0.0"}"`,
      CURRENT_PROJECT_VERSION: `"${cfg.ios?.buildNumber ?? "1"}"`,
      ENABLE_BITCODE: "NO",
      SKIP_INSTALL: "NO",
      SWIFT_EMIT_LOC_STRINGS: "YES",
      LD_RUNPATH_SEARCH_PATHS:
        '"$(inherited) @executable_path/Frameworks"',
      // The clip links no pods, so it must not inherit the app's Pods
      // xcconfig search paths.
      OTHER_LDFLAGS: '"$(inherited)"',
    });

    // `addTarget` creates both configurations with identical settings and the
    // Expo project sets no Swift conditions, so without this `#if DEBUG` is
    // never true — the debug-only routing picker would silently compile out —
    // and Release would build unoptimized.
    if (stripQuotes(configurations[configId].name) === "Debug") {
      Object.assign(settings, {
        SWIFT_ACTIVE_COMPILATION_CONDITIONS: "DEBUG",
        SWIFT_OPTIMIZATION_LEVEL: '"-Onone"',
        DEBUG_INFORMATION_FORMAT: "dwarf",
        ONLY_ACTIVE_ARCH: "YES",
      });
    } else {
      Object.assign(settings, {
        SWIFT_OPTIMIZATION_LEVEL: '"-O"',
        SWIFT_COMPILATION_MODE: "wholemodule",
        DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"',
        VALIDATE_PRODUCT: "YES",
      });
    }

    delete settings.PROVISIONING_PROFILE_SPECIFIER;
  }
}

/**
 * Adds the "Embed App Clips" copy-files phase to the main app target and makes
 * the app depend on the clip, so building the app builds and embeds the clip.
 */
function embedIntoMainApp(proj, target, cfg) {
  const mainTargetId = findMainAppTarget(proj, cfg.modRequest.projectName);
  if (!mainTargetId) {
    throw new Error(
      "[withVehicleAppClip] Could not locate the main application target to embed the clip into."
    );
  }

  // `addTargetDependency` silently does nothing unless both of these sections
  // already exist, and a freshly generated Expo project has neither.
  const objects = proj.hash.project.objects;
  objects["PBXTargetDependency"] = objects["PBXTargetDependency"] || {};
  objects["PBXContainerItemProxy"] = objects["PBXContainerItemProxy"] || {};

  proj.addTargetDependency(mainTargetId, [target.uuid]);

  const phase = proj.addBuildPhase(
    [],
    "PBXCopyFilesBuildPhase",
    "Embed App Clips",
    mainTargetId,
    "app_clips",
    '"$(CONTENTS_FOLDER_PATH)/AppClips"'
  );
  // `xcode` has no app_clips folder type; 16 is Xcode's "Products Directory"
  // spec, which is what Embed App Clips uses.
  phase.buildPhase.dstSubfolderSpec = 16;
  phase.buildPhase.dstPath = '"$(CONTENTS_FOLDER_PATH)/AppClips"';
  phase.buildPhase.name = '"Embed App Clips"';
  phase.buildPhase.runOnlyForDeploymentPostprocessing = 0;

  // Embed the clip's product (the .app wrapper produced by the clip target).
  const productRef = proj.pbxNativeTargetSection()[target.uuid].productReference;
  const buildFileId = proj.generateUuid();
  proj.hash.project.objects["PBXBuildFile"][buildFileId] = {
    isa: "PBXBuildFile",
    fileRef: productRef,
    settings: { ATTRIBUTES: ["RemoveHeadersOnCopy"] },
  };
  proj.hash.project.objects["PBXBuildFile"][`${buildFileId}_comment`] =
    `${TARGET_NAME}.app in Embed App Clips`;

  phase.buildPhase.files.push({
    value: buildFileId,
    comment: `${TARGET_NAME}.app in Embed App Clips`,
  });
}

function findMainAppTarget(proj, projectName) {
  const targets = proj.pbxNativeTargetSection();
  const keys = Object.keys(targets).filter((k) => !k.endsWith("_comment"));

  // Prefer an exact name match on the Expo-generated app target.
  if (projectName) {
    const exact = keys.find((k) => stripQuotes(targets[k].name) === projectName);
    if (exact) return exact;
  }
  // Otherwise the first plain application target that is not our clip.
  return keys.find(
    (k) =>
      stripQuotes(targets[k].productType) === "com.apple.product-type.application" &&
      stripQuotes(targets[k].name) !== TARGET_NAME
  );
}


// ── Shared scheme, so the clip is runnable from Xcode ──────────────────────

/**
 * Writes a shared scheme for the clip target.
 *
 * Called from `withClipTarget` rather than being its own mod: chained mods of
 * the same type are applied in reverse, so a separate step registered after it
 * would run *before* it and find no target to point the scheme at.
 *
 * Without this the target exists but no scheme does, so `TaksisClip` is missing
 * from Xcode's scheme picker and there is no obvious way to run the clip on a
 * device. Xcode autocreates schemes on open, but only unshared ones, and only
 * sometimes -- and `ios/` is regenerated by every prebuild, so an autocreated
 * scheme would not survive anyway.
 *
 * Not needed for store builds: the clip ships via the main app's "Embed App
 * Clips" phase, not as its own scheme. This is purely for development.
 */
function writeClipScheme(cfg, targetUuid) {
    const projectName = cfg.modRequest.projectName || "app";
    const schemeDir = path.join(
      cfg.modRequest.platformProjectRoot,
      `${projectName}.xcodeproj`,
      "xcshareddata",
      "xcschemes"
    );
    fs.mkdirSync(schemeDir, { recursive: true });

    const buildableReference = `            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "${targetUuid}"
               BuildableName = "${TARGET_NAME}.app"
               BlueprintName = "${TARGET_NAME}"
               ReferencedContainer = "container:${projectName}.xcodeproj">
            </BuildableReference>`;

    const scheme = `<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1430"
   version = "1.3">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
${buildableReference}
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
${buildableReference.replace(/^ {12}/gm, "            ")}
      </BuildableProductRunnable>
      <EnvironmentVariables>
         <EnvironmentVariable
            key = "_XCAppClipURL"
            value = "${DEBUG_INVOCATION_URL}"
            isEnabled = "YES">
         </EnvironmentVariable>
      </EnvironmentVariables>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
${buildableReference.replace(/^ {12}/gm, "            ")}
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
`;

    fs.writeFileSync(path.join(schemeDir, `${TARGET_NAME}.xcscheme`), scheme);
}

// ── Compose ─────────────────────────────────────────────────────────────────

module.exports = function withVehicleAppClip(config) {
  config = withClipSources(config);
  config = withParentAssociatedDomains(config);
  config = withClipTarget(config);
  return config;
};
