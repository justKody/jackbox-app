module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Compiles 'worklet' functions so the avatar animation can run on Filament's render thread.
    plugins: ['react-native-worklets-core/plugin'],
  };
};
