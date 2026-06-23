#!/bin/bash
set -e
cd "$(dirname "$0")"

# ── Environment ──────────────────────────────────────────────────────────────
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools"

# ── Force Java 17 ────────────────────────────────────────────────────────────
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

# ── Verify keystore fingerprint before doing anything ────────────────────────
KEYSTORE="credentials/android/keystore.jks"
STORE_PASS="3d8f00ea8699e1f5e18bbe7ae63fdc07"
EXPECTED_SHA1="78:C7:0C:D1:71:A1:B6:18:63:2F:B7:A8:1B:CE:15:0C:4D:B4:5C:61"

if [ ! -f "$KEYSTORE" ]; then
  echo "❌ Keystore not found at $KEYSTORE"
  exit 1
fi

ACTUAL_SHA1=$(keytool -list -keystore "$KEYSTORE" -storepass "$STORE_PASS" -v 2>/dev/null \
  | grep "SHA1:" | head -1 | awk '{print $2}')

if [ "$ACTUAL_SHA1" != "$EXPECTED_SHA1" ]; then
  echo "❌ Keystore fingerprint mismatch — aborting!"
  echo "   Expected: $EXPECTED_SHA1"
  echo "   Got:      $ACTUAL_SHA1"
  exit 1
fi
echo "✅ Keystore fingerprint verified ($ACTUAL_SHA1)"

# ── Kill Gradle daemons ──────────────────────────────────────────────────────
pkill -f gradle 2>/dev/null || true
sleep 2

# ── Clean prebuild ───────────────────────────────────────────────────────────
rm -rf android
npx expo prebuild --platform android

# ── local.properties ─────────────────────────────────────────────────────────
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

# ── Release signing config (original working sed approach) ───────────────────
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

# ── Hard verify signing config was injected correctly ────────────────────────
if ! grep -q "storeFile file" "$BUILD_GRADLE"; then
  echo "❌ Signing config injection failed — storeFile not found in build.gradle"
  echo "   Dumping signingConfigs region:"
  grep -n "signingConfig\|signingConfigs\|storeFile\|keyAlias" "$BUILD_GRADLE"
  exit 1
fi

# Confirm release buildType uses release signingConfig, not debug
RELEASE_SIGNING=$(awk '/release \{/,/\}/' "$BUILD_GRADLE" | grep "signingConfig" | head -1)
if echo "$RELEASE_SIGNING" | grep -q "signingConfigs.debug"; then
  echo "❌ release buildType is still using signingConfigs.debug — patch failed"
  exit 1
fi

echo "✅ Signing config verified"
echo "── signing region ──"
grep -n "signingConfig\|storeFile\|keyAlias" "$BUILD_GRADLE"
echo "────────────────────"

# ── Nuke Gradle caches + build artifacts ─────────────────────────────────────
rm -rf ~/.gradle/caches
rm -rf ~/.gradle/daemon
rm -rf ~/.gradle/native
rm -rf node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/build
rm -rf android/build
rm -rf android/app/build
rm -rf android/.gradle

# ── Kill iCloud duplicate .java files ────────────────────────────────────────
echo "🧹 Removing iCloud duplicate .java files..."
find android -name "* [0-9].java" -delete 2>/dev/null || true
find node_modules/expo/android/build/generated -name "* [0-9].java" -delete 2>/dev/null || true
echo "✅ Done"

# ── Build AAB ────────────────────────────────────────────────────────────────
cd android
./gradlew app:bundleRelease -x test --no-daemon || true
cd ..

# ── Verify AAB exists ────────────────────────────────────────────────────────
AAB="android/app/build/outputs/bundle/release/app-release.aab"
if [ ! -f "$AAB" ]; then
  echo "❌ AAB not found — build likely failed. Check output above."
  exit 1
fi

echo ""
echo "✅ Done. AAB at:"
echo "   $AAB"
echo "   Size: $(du -sh "$AAB" | cut -f1)"