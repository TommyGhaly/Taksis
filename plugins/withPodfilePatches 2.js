/**
 * Expo config plugin that applies this project's CocoaPods customisations.
 *
 * These used to live in `Podfile.template`, which `reset-ios.sh` copied over the
 * generated `ios/Podfile`. That worked for local resets but not for anything
 * that runs `expo prebuild` on its own — EAS Build, CI, or a plain prebuild —
 * because Expo generates the Podfile from its own template and never reads that
 * file. Moving them here means every path produces the same project.
 *
 * Three things, all inside `post_install`:
 *
 * 1. **C++20 for every pod target.** React Native 0.79's own pods need it, and
 *    the setting is not inherited across pod targets.
 *
 * 2. **The fmt/clang-21 fix.** fmt 11.0.2 — the version React Native 0.79 pins
 *    in `third-party-podspecs/fmt.podspec` — fails to compile itself on Xcode 26:
 *
 *      fmt/include/fmt/format-inl.h:59: error: call to consteval function
 *      'fmt::basic_format_string<...>::basic_format_string<FMT_COMPILE_STRING, 0>'
 *      is not a constant expression
 *
 *    clang 21 tightened when a `consteval` constructor may be called and fmt's
 *    own sources trip the new rule. Nothing in this project causes it and
 *    nothing can avoid it: every build on this toolchain hits it.
 *
 *    Note the fix is a *source rewrite*, not just the compiler flag. `base.h`
 *    defines `FMT_USE_CONSTEVAL` through an unguarded `#if/#elif` chain rather
 *    than the `#ifndef` pattern it uses for `FMT_USE_NONTYPE_TEMPLATE_ARGS`, so
 *    `-DFMT_USE_CONSTEVAL=0` is redefined by the header and lost. The flag is
 *    set anyway because it is correct for consumers of the header, but on its
 *    own it would look like a fix and do nothing. Delete this whole step once
 *    React Native bumps the fmt pin past 11.0.2; keeping it costs fmt's
 *    compile-time format-string checking.
 *
 * 3. **Architecture and platform settings**, so pods build for device and
 *    simulator and never for Mac Catalyst.
 */

const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# Project Podfile patches (plugins/withPodfilePatches.js)";

const RUBY_PATCH = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
        config.build_settings['ONLY_ACTIVE_ARCH'] = 'NO'
        config.build_settings['SUPPORTED_PLATFORMS'] = 'iphoneos iphonesimulator'
        config.build_settings['SUPPORTS_MACCATALYST'] = 'NO'
        if target.name == 'fmt'
          config.build_settings['OTHER_CPLUSPLUSFLAGS'] =
            '$(inherited) -DFMT_USE_NONTYPE_TEMPLATE_ARGS=0 -DFMT_USE_CONSTEVAL=0'
        end
      end
    end

    # The compiler flag above is not enough on its own: base.h defines
    # FMT_USE_CONSTEVAL through an unguarded #if/#elif chain, so it redefines
    # whatever -D sets. Rewrite the definition itself.
    fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      File.chmod(0644, fmt_base)
      content = File.read(fmt_base)
      patched = content.gsub(/^#\\s*define FMT_USE_CONSTEVAL 1$/, '#  define FMT_USE_CONSTEVAL 0')
      if patched != content
        File.write(fmt_base, patched)
        Pod::UI.puts '[withPodfilePatches] forced FMT_USE_CONSTEVAL=0 in fmt/base.h'
      end
    elsif Dir.exist?(installer.sandbox.pod_dir('fmt').to_s)
      raise '[withPodfilePatches] fmt pod is present but base.h was not found; ' \\
            'the fmt layout changed and the consteval fix no longer applies.'
    end
`;

module.exports = function withPodfilePatches(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile"
      );
      let contents = fs.readFileSync(podfilePath, "utf8");

      // prebuild can run mods more than once; a second copy would be harmless
      // but noisy.
      if (contents.includes(MARKER)) return cfg;

      const anchor = "  post_install do |installer|\n";
      if (!contents.includes(anchor)) {
        throw new Error(
          "[withPodfilePatches] Could not find the post_install hook in the generated Podfile. " +
            "Expo's template changed; update this plugin rather than dropping it, or the app " +
            "will not compile on Xcode 26."
        );
      }

      contents = contents.replace(anchor, anchor + RUBY_PATCH);
      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
