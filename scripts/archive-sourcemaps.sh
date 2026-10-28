#!/bin/sh
# Save the JS source map of the release build just made, keyed by build number,
# so scripts/crashes.py can map that build's crash stacks back to source.
# Run after every store build: the next build overwrites the map in place.
set -e
cd "$(dirname "$0")/.."

ANDROID_MAP=android/app/build/generated/sourcemaps/react/release/index.android.bundle.map
if [ -f "$ANDROID_MAP" ]; then
  build=$(node -p "require('./app.json').expo.android.versionCode")
  mkdir -p sourcemaps/android
  cp "$ANDROID_MAP" "sourcemaps/android/$build.map"
  echo "saved sourcemaps/android/$build.map"
fi

# iOS release builds only write a map when SOURCEMAP_FILE is set for the
# "Bundle React Native code and images" phase; point it at ios/build/main.jsbundle.map.
IOS_MAP=ios/build/main.jsbundle.map
if [ -f "$IOS_MAP" ]; then
  build=$(node -p "require('./app.json').expo.ios.buildNumber")
  mkdir -p sourcemaps/ios
  cp "$IOS_MAP" "sourcemaps/ios/$build.map"
  echo "saved sourcemaps/ios/$build.map"
fi
