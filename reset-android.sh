#!/bin/bash
set -e
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

# ── local.properties ─────────────────────────────────────────
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

# ── Write keystore.properties ─────────────────────────────────
# Referenced by build.gradle below — keeps credentials out of build.gradle
cat > android/keystore.properties << 'EOF'
storeFile=../../credentials/android/keystore.jks
storePassword=3d8f00ea8699e1f5e18bbe7ae63fdc07
keyAlias=d1987fae5a897e3130f253f75cde0f14
keyPassword=86b054c4d3a9739013c56e30ac5e816b
EOF

# ── Patch app/build.gradle with signing config ───────────────
# Uses Python for reliable multi-line injection — no fragile sed anchors.
python3 << 'PYEOF'
import re, sys

path = "android/app/build.gradle"
with open(path, "r") as f:
    src = f.read()

# 1. Inject keystoreProperties loader + signingConfigs block
#    after the first `android {` line, only if not already present.
if "keystoreProperties" not in src:
    loader = '''
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.withReader('UTF-8') { reader -> keystoreProperties.load(reader) }
}

'''
    src = re.sub(r'(android\s*\{)', loader + r'\1', src, count=1)

# 2. Inject signingConfigs block inside android { ... }
#    only if release signingConfig not already present.
if "signingConfigs" not in src:
    signing_block = '''
    signingConfigs {
        release {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
'''
    # Insert before the first `buildTypes {` block
    src = re.sub(r'(\s*buildTypes\s*\{)', signing_block + r'\1', src, count=1)

# 3. Point the release buildType at the release signingConfig
#    Replace `signingConfig signingConfigs.debug` inside the release block.
#    Find the release { ... } block and swap the signingConfig line.
def patch_release_block(text):
    # Match `release {` block and replace signingConfig inside it
    pattern = re.compile(
        r'(release\s*\{[^}]*?)'           # release { ... (non-greedy)
        r'(signingConfig\s+signingConfigs\.\w+)',
        re.DOTALL
    )
    return pattern.sub(r'\1signingConfig signingConfigs.release', text)

src = patch_release_block(src)

with open(path, "w") as f:
    f.write(src)

print("✅ build.gradle patched")
PYEOF

# ── Nuke Gradle caches + build artifacts ─────────────────────
rm -rf ~/.gradle/caches
rm -rf ~/.gradle/daemon
rm -rf ~/.gradle/native
rm -rf node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/build
rm -rf android/build
rm -rf android/app/build
rm -rf android/.gradle

# ── Kill iCloud duplicates before Gradle runs ─────────────────
# iCloud creates "File 2.java", "File 3.java" etc. when the project
# lives on Desktop. Delete them right before the build so they don't
# cause javac failures. The pattern matches any " N.java" suffix.
echo "🧹 Removing iCloud duplicate .java files..."
find android -name "* [0-9].java" -delete 2>/dev/null || true
find node_modules/expo/android/build/generated -name "* [0-9].java" -delete 2>/dev/null || true
echo "✅ Done"

# ── Build AAB ────────────────────────────────────────────────
cd android
./gradlew app:bundleRelease -x test
cd ..

echo ""
echo "✅ Done. AAB at:"
echo "   android/app/build/outputs/bundle/release/app-release.aab"