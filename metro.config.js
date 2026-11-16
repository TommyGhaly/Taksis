// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer'
);

defaultConfig.resolver.extraNodeModules = {
  stream: require.resolve('stream-browserify'),
  crypto: require.resolve('react-native-crypto'),
  buffer: require.resolve('buffer'),
  // add any other Node modules needed
};

// Agent worktrees live under .claude/worktrees, each with its own full
// node_modules (tens of GB). Metro would crawl and watch all of it, which
// stalls the watcher so edits in the real tree stop reaching the bundle.
defaultConfig.resolver.blockList = [
  ...[].concat(defaultConfig.resolver.blockList || []),
  /\/\.claude\/worktrees\/.*/,
];

// Defer module evaluation until first use. MainContainer + the nested
// navigators statically import ~46 screen modules, and without this every one
// of their module bodies (StyleSheet.create, Dimensions.get, top-level
// constants) is evaluated during bundle load, before the first frame.
defaultConfig.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: true,
    experimentalImportSupport: false,
  },
});

// Dev-only escape hatch for dev clients built before Crashlytics was added.
if (process.env.TAKSIS_STUB_CRASHLYTICS === '1') {
  const stub = require('path').join(__dirname, '.claude/crashlytics-stub.js');
  const upstream = defaultConfig.resolver.resolveRequest;
  defaultConfig.resolver.resolveRequest = (context, name, platform) =>
    name === '@react-native-firebase/crashlytics'
      ? { type: 'sourceFile', filePath: stub }
      : (upstream || context.resolveRequest)(context, name, platform);
}

module.exports = defaultConfig;
