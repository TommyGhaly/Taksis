// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');

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

module.exports = defaultConfig;
