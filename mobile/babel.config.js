module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated v4 plugin moved to react-native-worklets; keep last
      'react-native-worklets/plugin'
    ]
  };
};
