const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const defaultConfig = getSentryExpoConfig(__dirname)
defaultConfig.resolver.sourceExts.push('cjs')

module.exports = {
  ...defaultConfig,
  transformer: {
    ...defaultConfig.transformer,
    assetPlugins: ['expo-asset/tools/hashAssetFiles'],
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  },
  resolver: {
    ...defaultConfig.resolver,
    assetExts: [
      ...defaultConfig.resolver.assetExts,
      'db',
      'sqlite',
      'mp3',
      'ttf',
      'otf',
      'png',
      'jpg',
      'jpeg',
      'json',
      'txt',
      'html',
    ],
  },
}
