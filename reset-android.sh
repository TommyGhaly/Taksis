#!/bin/bash
set -e
cd "$(dirname "$0")"

# Usage:
#   ./reset-android.sh              bump the versionCode, then build the AAB
#   ./reset-android.sh --no-bump    rebuild the same versionCode — only when the
#                                   last one never reached Play

BUMP=1
for arg in "$@"; do
  case "$arg" in
    --bump)    BUMP=1 ;;
    --no-bump) BUMP=0 ;;
    *) echo "❌ Unknown option '$arg'. Usage: ./reset-android.sh [--no-bump]"; exit 1 ;;
  esac
done

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
# Signing secrets live in a gitignored file, not in this script.
KEYSTORE_ENV="credentials/android/keystore.env"
if [ ! -f "$KEYSTORE_ENV" ]; then
  echo "❌ Missing $KEYSTORE_ENV (STORE_PASS, KEY_ALIAS, KEY_PASS)"
  exit 1
fi
. "$KEYSTORE_ENV"
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

# ── Bump the versionCode ─────────────────────────────────────────────────────
#
# This script only ever produces an upload AAB, so the bump is the default
# rather than a flag. Play refuses a versionCode it has already seen and it
# refuses it *after the whole AAB has uploaded*, so forgetting costs a full
# build and a full upload; bumping when you did not need to costs a gap in a
# sequence nobody reads. Pass --no-bump on a rebuild that never reached Play.
#
# Before the prebuild, because `expo prebuild` reads app.json to write
# android/app/build.gradle. Bumping after it would change the file and leave
# the AAB carrying the old number.
if [ "$BUMP" = "1" ]; then
  CURRENT=$(grep -o '"versionCode": [0-9]*' app.json | grep -o '[0-9]*$')
  if [ -z "$CURRENT" ]; then
    echo "❌ No \"versionCode\" in app.json — cannot bump. Every build from here would reuse a versionCode Play has seen."
    exit 1
  fi

  NEXT=$((CURRENT + 1))

  # Shown, not required: Enter takes the bump straight away, typing a number
  # uses that instead, and leaving it alone takes the bump after 10 seconds, so
  # an unattended run is never stuck here. No terminal attached (a task runner,
  # CI) skips the prompt.
  if [ -t 0 ]; then
    while true; do
      ANSWER=""
      read -r -t 10 -p "→ Android versionCode $CURRENT → $NEXT — Enter (or wait 10s) to accept, or type another: " ANSWER || echo ""
      [ -z "$ANSWER" ] && break
      if [[ "$ANSWER" =~ ^[0-9]+$ ]] && [ "$ANSWER" -gt "$CURRENT" ]; then
        NEXT="$ANSWER"
        break
      fi
      echo "   '$ANSWER' is not a whole number above $CURRENT — Play only accepts a higher versionCode."
    done
  fi

  sed -i '' "s/\"versionCode\": ${CURRENT}/\"versionCode\": ${NEXT}/" app.json

  # Read back: a sed that matched nothing looks exactly like a successful bump.
  WROTE=$(grep -o '"versionCode": [0-9]*' app.json | grep -o '[0-9]*$')
  if [ "$WROTE" != "$NEXT" ]; then
    echo "❌ Tried to bump versionCode to $NEXT, app.json still reads $WROTE"
    exit 1
  fi
  echo "✅ versionCode $CURRENT → $NEXT (commit app.json with the release)"
else
  echo "⏭  versionCode left at $(grep -o '"versionCode": [0-9]*' app.json | grep -o '[0-9]*$')"
fi

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
\            storePassword '\'''"$STORE_PASS"''\''\
\            keyAlias '\'''"$KEY_ALIAS"''\''\
\            keyPassword '\'''"$KEY_PASS"''\''\
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
echo "   versionCode $(grep -o '"versionCode": [0-9]*' app.json | grep -o '[0-9]*$')"
echo "   Size: $(du -sh "$AAB" | cut -f1)"