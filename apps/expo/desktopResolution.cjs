// Module resolution of the desktop build (ADR-0107), applied only when BIBLE_STRONG_DESKTOP=1.
//
// The desktop app is the web export run by the Tauri shell, plus Offline copies. Three rules,
// in order:
// 1. The native packages of the Offline-copy pipeline resolve to shims over the shell's
//    commands (`src/desktop/shims/`).
// 2. A `<name>.desktop.<ext>` file beside the resolved one replaces it.
// 3. For the files listed below, whose `.web` variant only removes Offline copies, the shared
//    (native) file replaces the `.web` one.
const fs = require('fs')
const path = require('path')

const IS_DESKTOP_BUILD = process.env.BIBLE_STRONG_DESKTOP === '1'

const PACKAGE_SHIMS = {
  'expo-file-system/legacy': 'src/desktop/shims/expoFileSystemLegacy.ts',
  'expo-sqlite': 'src/desktop/shims/expoSqlite.ts',
  'rn-fetch-blob': 'src/desktop/shims/rnFetchBlob.ts',
  'react-native-zip-archive': 'src/desktop/shims/reactNativeZipArchive.ts',
}

const SHARED_ON_DESKTOP = new Set([
  'src/features/bible/BibleErrorView',
  'src/features/bible/BibleReferenceAvailability',
  'src/features/bible/VersionSelectorItem',
  'src/features/bible/VersionSelectorSheet/BibleOfflineDetailsSheet',
  'src/features/commentaries/CommentaryManageButton',
  'src/features/home/ResourceDownloadWidget',
  'src/features/resources/ResourceUnavailableView',
  'src/features/resources/resourceAccess',
  'src/features/settings/DownloadsScreen',
  'src/helpers/biblesDb',
  'src/helpers/downloadManager',
  'src/helpers/sqlite',
])

const SOURCE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js']
const exists = new Map()
const fileExists = filePath => {
  if (!exists.has(filePath)) exists.set(filePath, fs.existsSync(filePath))
  return exists.get(filePath)
}
const firstExisting = (base, preferred) =>
  [preferred, ...SOURCE_EXTENSIONS].map(extension => `${base}.${extension}`).find(fileExists)

const desktopFileFor = (projectRoot, filePath) => {
  if (filePath.includes(`${path.sep}node_modules${path.sep}`)) return filePath
  const match = /^(.*?)(\.web)?\.(tsx|ts|jsx|js)$/.exec(filePath)
  if (!match) return filePath
  const [, base, web, extension] = match
  const desktop = firstExisting(`${base}.desktop`, extension)
  if (desktop) return desktop
  const relativeBase = path.relative(projectRoot, base).split(path.sep).join('/')
  if (web && SHARED_ON_DESKTOP.has(relativeBase)) return firstExisting(base, extension) ?? filePath
  return filePath
}

// An import that names its variant (`./FullAppRuntime.web`) gets exactly that file.
const EXPLICIT_VARIANT = /\.(web|desktop|native|ios|android)$/

function withDesktopResolution(config, projectRoot) {
  const upstream = config.resolver.resolveRequest
  return {
    ...config,
    resolver: {
      ...config.resolver,
      resolveRequest(context, moduleName, platform) {
        const shim = PACKAGE_SHIMS[moduleName]
        if (shim) return { type: 'sourceFile', filePath: path.join(projectRoot, shim) }
        const resolution = (upstream ?? context.resolveRequest)(context, moduleName, platform)
        if (resolution.type !== 'sourceFile' || EXPLICIT_VARIANT.test(moduleName)) {
          return resolution
        }
        return { ...resolution, filePath: desktopFileFor(projectRoot, resolution.filePath) }
      },
    },
  }
}

module.exports = {
  IS_DESKTOP_BUILD,
  PACKAGE_SHIMS,
  SHARED_ON_DESKTOP,
  desktopFileFor,
  withDesktopResolution,
}
