#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "→ Closing Xcode"
osascript -e 'quit app "Xcode"' 2>/dev/null || true
sleep 2

echo "→ Wiping ios/"
rm -rf ios

echo "→ Running prebuild"
npx expo prebuild --platform ios

echo "→ Copying GoogleService-Info.plist"
cp GoogleService-Info.plist ios/app/GoogleService-Info.plist

echo "→ Copying Podfile"
cp Podfile.template ios/Podfile

echo "→ Verifying Firebase AppDelegate patch"
# This used to be a sed patch here. It now lives in plugins/withFirebaseAppDelegate.js
# so that a bare `expo prebuild` — CI, EAS Build, a fresh clone — gets it too,
# not just runs of this script. Kept as a check so a silent plugin regression
# still fails loudly here instead of at app launch.
APPDELEGATE="ios/app/AppDelegate.swift"
if ! grep -q "FirebaseApp.configure()" "$APPDELEGATE"; then
  echo "   ✗ FirebaseApp.configure() missing from $APPDELEGATE — plugins/withFirebaseAppDelegate.js did not run or its anchor broke" >&2
  exit 1
fi

echo "→ Asset catalog"
mkdir -p ios/app/Images.xcassets/AppIcon.appiconset
echo '{"info":{"version":1,"author":"xcode"}}' > ios/app/Images.xcassets/Contents.json
echo '{"images":[{"idiom":"universal","platform":"ios","size":"1024x1024","filename":"AppIcon.png"}],"info":{"version":1,"author":"xcode"}}' > ios/app/Images.xcassets/AppIcon.appiconset/Contents.json
cp assets/icon.png ios/app/Images.xcassets/AppIcon.appiconset/AppIcon.png

echo "→ Entitlements"
cat > ios/app/app.entitlements << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>production</string>
	<key>com.apple.developer.applesignin</key>
	<array>
		<string>Default</string>
	</array>
</dict>
</plist>
EOF

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
cd ios && pod install --repo-update && cd ..

echo "→ Patching fmt/base.h to disable consteval"
FMT_BASE="ios/Pods/fmt/include/fmt/base.h"
if [ ! -f "$FMT_BASE" ]; then
  echo "   ✗ $FMT_BASE not found after pod install" >&2
  exit 1
fi
sed -i '' 's/#elif defined(__cpp_consteval)/#elif 0 \/\/ defined(__cpp_consteval)/' "$FMT_BASE"
sed -i '' 's/#elif FMT_GCC_VERSION >= 1002 || FMT_CLANG_VERSION >= 1101/#elif 0 \/\/ disabled/' "$FMT_BASE"
# Verify the consteval guard is actually neutralized — sed returns 0 even on a
# no-op, so a wording change in fmt would silently skip the patch and surface
# as a confusing build error later.
if grep -q '#elif defined(__cpp_consteval)' "$FMT_BASE"; then
  echo "   ✗ fmt consteval patch did not apply — fmt/base.h wording may have changed; update the sed patterns" >&2
  exit 1
fi

echo "→ Opening workspace"
open -a Xcode "$(pwd)/ios/app.xcworkspace"

echo "✓ Done"