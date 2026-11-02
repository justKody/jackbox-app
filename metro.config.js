const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The avatars ship as glTF binaries, loaded by react-native-filament.
config.resolver.assetExts.push('glb');

module.exports = config;
