require('./scripts/generate-theme-css.cjs')
const crypto = require('crypto')
const os = require('os')
const path = require('path')
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const { withUniwindConfig } = require('uniwind/metro')

const { getBundleModeMetroConfig } = require('react-native-worklets/bundleMode')
const config = getSentryExpoConfig(__dirname)
// Bundle Mode writes each worklet as its own module here, while Metro is running.
config.watchFolders = [
  ...(config.watchFolders || []),
  path.join(path.dirname(require.resolve('react-native-worklets/package.json')), '.worklets'),
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

// One transform cache per checkout. Metro keys a file by its project-relative path and its
// content, so master and the .claude/worktrees lanes used to share transforms through
// $TMPDIR/metro-cache. Expo's `use dom` proxies carry their absolute path: master could load
// a lane's DOM bundle, and a lane's `--clear` emptied master's cache. Uniwind sets the store
// (it skips CSS outputs): only its directory changes.
if (styledConfig.cacheStores?.length === 1) {
  const checkoutId = crypto.createHash('sha1').update(__dirname).digest('hex').slice(0, 8)
  const checkoutName = path.basename(path.resolve(__dirname, '../..'))
  const FileStore = styledConfig.cacheStores[0].constructor
  styledConfig.cacheStores = [
    new FileStore({ root: path.join(os.tmpdir(), `metro-cache-${checkoutName}-${checkoutId}`) }),
  ]
}

// Worklet runtimes only exist on native: a web-only run keeps the plain configuration.
const webOnly =
  process.argv.includes('--web') ||
  process.argv.some((arg, index) => arg === '--platform' && process.argv[index + 1] === 'web')

function withBundleMode(metroConfig) {
  const resolveWithoutBundleMode = metroConfig.resolver.resolveRequest
  const bundleModeConfig = getBundleModeMetroConfig(metroConfig)
  const resolveWithBundleMode = bundleModeConfig.resolver.resolveRequest
  const uniwindPath = `${path.sep}node_modules${path.sep}uniwind${path.sep}`
  // Bundle Mode sends every `react-native` import through its shim, and Uniwind sends the
  // shim's own import to its components, which import `react-native` again. Left alone the
  // two redirections form a cycle and React Native never loads: Uniwind's import goes
  // straight to React Native.
  bundleModeConfig.resolver.resolveRequest = (context, moduleName, platform) =>
    moduleName === 'react-native' && context.originModulePath.includes(uniwindPath)
      ? resolveWithoutBundleMode(context, moduleName, platform)
      : resolveWithBundleMode(context, moduleName, platform)
  return bundleModeConfig
}

module.exports = webOnly ? styledConfig : withBundleMode(styledConfig)
