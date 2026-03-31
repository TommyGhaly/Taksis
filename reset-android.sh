#!/bin/bash
cd "$(dirname "$0")"

# ── Environment ──────────────────────────────────────────────
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools"

# ── Check Java version ───────────────────────────────────────
JAVA_VER=$(java -version 2>&1 | head -1 | grep -oE '"[0-9]+' | tr -d '"')
if [ -z "$JAVA_VER" ]; then
  echo "❌ Java not found. Install Java 17: brew install openjdk@17"
  exit 1
elif [ "$JAVA_VER" -lt 17 ]; then
  echo "❌ Java $JAVA_VER detected. Gradle 8.13 requires Java 17+."
  echo "   Switch terminal or run: export JAVA_HOME=\$(/usr/libexec/java_home -v 17)"
  exit 1
else
  echo "✅ Java $JAVA_VER"
fi

# ── Kill Gradle daemons ──────────────────────────────────────
pkill -f gradle 2>/dev/null || true

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
\            storePassword '\''REDACTED'\''\
\            keyAlias '\''REDACTED'\''\
\            keyPassword '\''REDACTED'\''\
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
./gradlew bundleRelease -x test
cd ..

echo ""
echo "Done. AAB at:"
echo "  android/app/build/outputs/bundle/release/app-release.aab"