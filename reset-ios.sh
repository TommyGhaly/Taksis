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

# Pods
cd ios && pod install --repo-update && cd ..
echo "Done. Run: npx expo run:ios --device \"iPhone 16 Pro\""
