#!/bin/bash
cd "$(dirname "$0")"

# ── Environment ──────────────────────────────────────────────
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools"

# ── Force Java 17 ────────────────────────────────────────────
export JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null)
if [ -z "$JAVA_HOME" ]; then
  echo "❌ Java 17 not found. Install: brew install openjdk@17"
  exit 1
fi
export PATH="$JAVA_HOME/bin:$PATH"

JAVA_VER=$(java -version 2>&1 | head -1 | grep -oE '"[0-9]+' | tr -d '"')
if [ "$JAVA_VER" != "17" ]; then
  echo "❌ Expected Java 17, got $JAVA_VER"
  exit 1
fi
echo "✅ Java $JAVA_VER"

# ── Kill Gradle daemons ──────────────────────────────────────
pkill -f gradle 2>/dev/null || true
sleep 2

# ── Clean prebuild ───────────────────────────────────────────
rm -rf android
npx expo prebuild --platform android

# ── local.properties (SDK path) ──────────────────────────────
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

# ── Release signing config ───────────────────────────────────
BUILD_GRADLE="android/app/build.gradle"

sed -i '' '/signingConfigs {/,/^    }/ {
    /debug {/,/^        }/ {
        /^        }/a\
\        release {\
\            storeFile file('\''../../credentials/android/keystore.jks'\'')\
\            storePassword '\''3d8f00ea8699e1f5e18bbe7ae63fdc07'\''\
\            keyAlias '\''d1987fae5a897e3130f253f75cde0f14'\''\
\            keyPassword '\''86b054c4d3a9739013c56e30ac5e816b'\''\
\        }
    }
}' "$BUILD_GRADLE"

sed -i '' 's/signingConfig signingConfigs\.debug/signingConfig signingConfigs.release/' "$BUILD_GRADLE"
sed -i '' '/debug {/{n;s/signingConfig signingConfigs\.release/signingConfig signingConfigs.debug/;}' "$BUILD_GRADLE"

# ── Nuke ALL Gradle caches + RN plugin build artifacts ───────
rm -rf ~/.gradle/caches
rm -rf ~/.gradle/daemon
rm -rf ~/.gradle/native
rm -rf node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/build
rm -rf android/build
rm -rf android/app/build
rm -rf android/.gradle

# ── Build AAB ────────────────────────────────────────────────
cd android
./gradlew app:bundleRelease -x test
cd ..

echo ""
echo "✅ Done. AAB at:"
echo "   android/app/build/outputs/bundle/release/app-release.aab"