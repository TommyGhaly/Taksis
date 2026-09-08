/**
 * Expo config plugin that makes the `fmt` pod compile under Apple clang 21.
 *
 * fmt 11.0.2 — the version React Native 0.79 pins in
 * `third-party-podspecs/fmt.podspec` — fails to compile itself on Xcode 26:
 *
 *   fmt/include/fmt/format-inl.h:59: error: call to consteval function
 *   'fmt::basic_format_string<...>::basic_format_string<FMT_COMPILE_STRING, 0>'
 *   is not a constant expression
 *
 * clang 21 tightened when a `consteval` constructor may be called, and fmt's own
 * sources trip the new rule. Nothing in this project causes it and nothing in
 * this project can avoid it: any build of the app on this toolchain hits it.
 *
 * The fix is to make fmt fall back to its non-consteval path by forcing
 * `FMT_USE_CONSTEVAL` to 0. That has to be a source edit. `base.h` defines the
 * macro through an unguarded `#if/#elif` chain rather than the `#ifndef` pattern
 * it uses for `FMT_USE_NONTYPE_TEMPLATE_ARGS`, so a `-DFMT_USE_CONSTEVAL=0`
 * compiler flag is simply redefined by the header and lost. The flag is set here
 * as well, because it is harmless and correct for consumers of the header, but
 * the header rewrite is what actually fixes the build.
 *
 * This lives in a plugin rather than in `Podfile.template` because
 * `expo prebuild` generates `ios/Podfile` from its own template and never reads
 * that file — so the fix, which the repo already contained, was being silently
 * discarded on every regeneration.
 *
 * Delete this once fmt is past 11.0.2 (React Native bumps the pin) or once
 * upstream fmt supports clang 21. Keeping it after that costs the compile-time
 * format-string checking that `consteval` provides.
 */

const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# fmt/clang-21 consteval fix (plugins/withFmtConstevalFix.js)";

const RUBY_PATCH = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['OTHER_CPLUSPLUSFLAGS'] =
          '$(inherited) -DFMT_USE_NONTYPE_TEMPLATE_ARGS=0 -DFMT_USE_CONSTEVAL=0'
      end
    end

    # The compiler flag above is not enough: base.h defines FMT_USE_CONSTEVAL
    # through an unguarded #if/#elif chain, so it redefines whatever -D sets.
    # Rewrite the definition itself.
    fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      File.chmod(0644, fmt_base)
      content = File.read(fmt_base)
      patched = content.gsub(/^#\\s*define FMT_USE_CONSTEVAL 1$/, '#  define FMT_USE_CONSTEVAL 0')
      if patched != content
        File.write(fmt_base, patched)
        Pod::UI.puts '[withFmtConstevalFix] forced FMT_USE_CONSTEVAL=0 in fmt/base.h'
      end
    end
`;

module.exports = function withFmtConstevalFix(config) {
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
          "[withFmtConstevalFix] Could not find the post_install hook in the generated Podfile. " +
            "Expo's template changed; update this plugin rather than dropping it, or the " +
            "app will not compile on Xcode 26."
        );
      }

      contents = contents.replace(anchor, anchor + RUBY_PATCH);
      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
