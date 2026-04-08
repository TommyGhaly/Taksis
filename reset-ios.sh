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

echo "→ Firebase AppDelegate patch"
sed -i '' '/bindReactNativeFactory(factory)/a\
    FirebaseApp.configure()' ios/app/AppDelegate.swift

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

echo "→ Clearing DerivedData"
rm -rf ~/Library/Developer/Xcode/DerivedData/app-*

echo "→ Pod install"
cd ios && pod install --repo-update && cd ..

echo "→ Patching fmt/base.h to disable consteval"
FMT_BASE="ios/Pods/fmt/include/fmt/base.h"
sed -i '' 's/#elif defined(__cpp_consteval)/#elif 0 \/\/ defined(__cpp_consteval)/' "$FMT_BASE"
sed -i '' 's/#elif FMT_GCC_VERSION >= 1002 || FMT_CLANG_VERSION >= 1101/#elif 0 \/\/ disabled/' "$FMT_BASE"

echo "→ Clearing stale Xcode bookmarks"
killall -9 sharedfilelistd 2>/dev/null || true
killall -9 scopedbookmarksagent 2>/dev/null || true
sudo rm -rf "/Users/tommyghaly/Library/Application Support/com.apple.sharedfilelist/" 2>/dev/null || true
sleep 2

echo "→ Opening workspace"
open ios/app.xcworkspace

echo "✓ Done"