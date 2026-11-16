module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54) adds the react-native-worklets plugin that
    // Reanimated 4 needs automatically; listing it here would apply it twice.
    presets: ['babel-preset-expo'],
  };
};
