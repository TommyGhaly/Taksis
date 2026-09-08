#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

# Regenerates ios/ from scratch and opens the workspace.
#
# `ios/` is gitignored generated output. Everything this project needs on top of
# a stock `expo prebuild` now lives in config plugins (see plugins/), so a plain
# prebuild — including the one EAS Build runs — produces the same project this
# script does. That was not true before: the Podfile customisations lived in
# Podfile.template and the Firebase call was patched in by sed here, so anything
# that ran prebuild on its own got a project that built and was broken.
#
# What the plugins do, so it is findable from here:
#   withPodfilePatches      c++20, arch/platform settings, and the fmt/clang-21
#                           consteval fix (fmt 11.0.2 cannot compile on Xcode 26)
#   withFirebaseAppDelegate FirebaseApp.configure(), which @react-native-firebase
#                           skips on this project while still adding its import
#   withVehicleAppClip      the TaksisClip App Clip target, its sources, scheme,
#                           embed phase, and the associated-domains entitlements
#
# This script therefore does the parts a plugin cannot: wiping state, running
# pods, and checking afterwards that every addition actually landed.

fail() { echo "   ✗ $1" >&2; exit 1; }

# CocoaPods requires a UTF-8 locale. An interactive Terminal usually has one, but
# a non-interactive shell -- CI, an editor's task runner, anything invoking this
# script rather than a person typing it -- often has LANG unset, and pod install
# then dies with:
#
#   Unicode Normalization not appropriate for ASCII-8BIT (Encoding::CompatibilityError)
#
# which names neither CocoaPods nor the locale. Set it here rather than relying on
# whatever the caller happens to have.
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

echo "→ Closing Xcode"
osascript -e 'quit app "Xcode"' 2>/dev/null || true
sleep 2

echo "→ Wiping ios/"
rm -rf ios

echo "→ Running prebuild"
npx expo prebuild --platform ios --no-install

echo "→ Clearing build cache (keeps the index → no full re-index on open)"
# NOTE: previously this nuked all of DerivedData (rm -rf ...app-*), which wiped
# Index.noindex too and forced a multi-minute re-index every run (the blank-
# window-on-open symptom). The full wipe was blanket insurance against phantom
# errors, not a fix for a known one.
#
# This narrower clear removes the two most common phantom-error sources — stale
# build intermediates and the shared module cache — while LEAVING each project's
# Index.noindex intact, so Xcode opens fast.
#
# FALLBACK: if phantom errors (red on valid code, bad autocomplete) come back,
# note the exact error text first, then add this line to also clear the index
# for this project and accept a one-time re-index wait:
#     rm -rf ~/Library/Developer/Xcode/DerivedData/app-*/Index.noindex
rm -rf ~/Library/Developer/Xcode/DerivedData/app-*/Build
rm -rf ~/Library/Developer/Xcode/DerivedData/ModuleCache.noindex

echo "→ Pod install"
( cd ios && pod install --repo-update )

# ── Verify every addition actually landed ────────────────────────────────────
#
# Each of these fails silently if its plugin stops matching an upstream template:
# the project still builds, and breaks later in a way that does not point back
# here. Checking is cheap; debugging any of them from the symptom is not.

echo "→ Verifying"

grep -q "FirebaseApp.configure()" ios/app/AppDelegate.swift \
  || fail "FirebaseApp.configure() missing from AppDelegate — withFirebaseAppDelegate did not apply. The app would build and then fail on the first Firestore or Auth call."

grep -q "appclips:" ios/app/app.entitlements \
  || fail "associated-domains missing from app.entitlements — withVehicleAppClip did not apply. Universal links and the App Clip would silently not work."

grep -q "TaksisClip" ios/app.xcodeproj/project.pbxproj \
  || fail "TaksisClip target missing from the Xcode project — withVehicleAppClip did not apply."

grep -q "Embed App Clips" ios/app.xcodeproj/project.pbxproj \
  || fail "Embed App Clips build phase missing — the clip would not ship inside the app."

grep -q "appclips:" ios/TaksisClip/TaksisClip.entitlements \
  || fail "associated-domains missing from the clip's entitlements."

test -f ios/app.xcodeproj/xcshareddata/xcschemes/TaksisClip.xcscheme \
  || fail "TaksisClip scheme missing — the clip could not be run from Xcode."

grep -q "define FMT_USE_CONSTEVAL 1" ios/Pods/fmt/include/fmt/base.h \
  && fail "fmt/base.h still enables consteval — withPodfilePatches did not apply. The build fails on Xcode 26 with 'call to consteval function ... is not a constant expression'."

test -f ios/app/GoogleService-Info.plist \
  || fail "GoogleService-Info.plist missing from ios/app — check ios.googleServicesFile in app.json."

# The App Clip's version and build must match the parent app exactly or App Store
# Connect rejects the upload, and it rejects it after the whole archive uploads.
APP_V=$(plutil -extract CFBundleShortVersionString raw ios/app/Info.plist)
APP_B=$(plutil -extract CFBundleVersion raw ios/app/Info.plist)
CLIP_V=$(xcodebuild -project ios/app.xcodeproj -target TaksisClip -configuration Release -showBuildSettings 2>/dev/null | awk '/ MARKETING_VERSION =/{print $3}')
CLIP_B=$(xcodebuild -project ios/app.xcodeproj -target TaksisClip -configuration Release -showBuildSettings 2>/dev/null | awk '/ CURRENT_PROJECT_VERSION =/{print $3}')
[ "$APP_V" = "$CLIP_V" ] && [ "$APP_B" = "$CLIP_B" ] \
  || fail "Version mismatch: app $APP_V ($APP_B) vs clip $CLIP_V ($CLIP_B). App Store Connect rejects a clip whose version differs from its parent."

echo "   ✓ Firebase configured, App Clip target + scheme + entitlements present, fmt patched"
echo "   ✓ app and clip both at $APP_V ($APP_B)"

echo "→ Opening workspace"
open -a Xcode "$(pwd)/ios/app.xcworkspace"

echo "✓ Done"
echo
echo "  To archive: scheme 'app', destination 'Any iOS Device', Product → Archive."
echo "  Before uploading, confirm TaksisClip.app is inside app.app/AppClips/."
