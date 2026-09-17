require('./scripts/generate-theme-css.cjs')
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const { withUniwindConfig } = require('uniwind/metro')

const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode')
const config = getSentryExpoConfig(__dirname)
config.watchFolders = [
  ...(config.watchFolders || []),
  require('path').join(
    require('path').dirname(require.resolve('react-native-worklets/package.json')),
    '.worklets'
  ),
]

config.resolver = {
  ...config.resolver,
  assetExts: [
    ...config.resolver.assetExts,
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
    'lottie',
  ],
}

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      inlineRequires: true,
    },
  }),
}

const styledConfig = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './src/uniwind-types.d.ts',
  extraThemes: ['default', 'sepia', 'nature', 'sunset', 'black', 'mauve', 'night'],
})
const webOnly =
  process.argv.includes('--web') ||
  process.argv.some((arg, index) => arg === '--platform' && process.argv[index + 1] === 'web')
module.exports = webOnly ? styledConfig : getBundleModeMetroConfig(styledConfig)
