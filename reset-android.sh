#!/bin/bash
cd "$(dirname "$0")"

# ── Environment ──────────────────────────────────────────────
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools"

# ── Clean prebuild ───────────────────────────────────────────
rm -rf android
npx expo prebuild --platform android

# ── local.properties (SDK path) ──────────────────────────────
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

# ── Release signing config ───────────────────────────────────
# Prebuild always sets release to signingConfigs.debug.
# Patch build.gradle to add release signingConfig and point to it.
BUILD_GRADLE="android/app/build.gradle"

# Inject release signingConfig block after the debug block
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

# Swap release buildType from debug signing to release signing
sed -i '' 's/signingConfig signingConfigs\.debug/signingConfig signingConfigs.release/' "$BUILD_GRADLE"
# Restore the actual debug buildType back to debug signing
sed -i '' '/debug {/{n;s/signingConfig signingConfigs\.release/signingConfig signingConfigs.debug/;}' "$BUILD_GRADLE"

# ── Clear Gradle caches (avoid 8.13 cache corruption) ───────
rm -rf ~/.gradle/caches/8.13/kotlin-dsl
rm -rf android/build
rm -rf android/app/build
rm -rf android/.gradle

'''# ── Build AAB ────────────────────────────────────────────────
cd android
./gradlew bundleRelease -x test
cd ..'''

'''echo ""
echo "Done. AAB at:"
echo "  android/app/build/outputs/bundle/release/app-release.aab"'''
echo "Done resetting Android project. Please run './gradlew bundleRelease -x test' in the android directory to build the AAB."