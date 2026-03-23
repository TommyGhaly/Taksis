#!/bin/bash
cd "$(dirname "$0")"
rm -rf ios
npx expo prebuild --platform ios

# Firebase init
sed -i '' '/bindReactNativeFactory(factory)/a\
    FirebaseApp.configure()' ios/app/AppDelegate.swift

# Asset catalog
mkdir -p ios/app/Images.xcassets/AppIcon.appiconset
echo '{"info":{"version":1,"author":"xcode"}}' > ios/app/Images.xcassets/Contents.json
echo '{"images":[{"idiom":"universal","platform":"ios","size":"1024x1024","filename":"AppIcon.png"}],"info":{"version":1,"author":"xcode"}}' > ios/app/Images.xcassets/AppIcon.appiconset/Contents.json
cp assets/icon.png ios/app/Images.xcassets/AppIcon.appiconset/AppIcon.png

# Entitlements
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

# Clear derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/app-*

# Pods
cd ios && pod install --repo-update && cd ..
echo "Done. Open ios/app.xcworkspace in Xcode and Archive."
