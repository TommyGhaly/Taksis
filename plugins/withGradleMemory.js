const { withGradleProperties } = require('expo/config-plugins');

// Release builds run KSP over every Expo module and exhaust the template's 512 MiB
// metaspace ("OutOfMemoryError: Metaspace" in :expo-updates:kspReleaseKotlin).
const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'org.gradle.jvmargs'),
    );
    cfg.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS });
    return cfg;
  });
};
