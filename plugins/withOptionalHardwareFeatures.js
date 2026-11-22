const { withAndroidManifest } = require('expo/config-plugins');

// Play infers required hardware from the manifest even with no <uses-feature>:
// screenOrientation="portrait" implies android.hardware.screen.portrait, and the
// ACCESS_WIFI_STATE permission (merged in by Firebase/Play services) implies
// android.hardware.wifi. Implied features count as required, so Play hid the app
// from tablets, desktops and XR devices and blocked review. Declaring them with
// required="false" keeps the behaviour but drops the install filter.
const OPTIONAL_FEATURES = ['android.hardware.screen.portrait', 'android.hardware.wifi'];

module.exports = function withOptionalHardwareFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest['uses-feature'] ||= []);
    for (const name of OPTIONAL_FEATURES) {
      const existing = features.find((f) => f.$['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
};
