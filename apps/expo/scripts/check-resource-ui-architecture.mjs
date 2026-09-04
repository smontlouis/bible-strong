import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoots = ['app', 'src/common', 'src/features', 'src/navigation'].map(directory =>
  path.join(root, directory)
)

const collectFiles = async directory => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(entry => {
      const target = path.join(directory, entry.name)
      return entry.isDirectory() ? collectFiles(target) : [target]
    })
  )
  return nested.flat().filter(file => /\.[jt]sx?$/.test(file) && !file.includes('__tests__'))
}

const retiredModules = [
  '~common/waitForTimeline',
  '~common/resourceDatabaseAccess',
  '~helpers/databaseState',
]
const screenLevelAvailabilityCalls = [
  'getIfDatabaseNeedsDownload',
  'getIfVersionNeedsDownload',
  'isVersionInstalled',
  'getStrongBibleSidecarAvailability',
  'getInterlinearSidecarAvailability',
  'getStrongLexiconModuleAvailability',
  'hasPericopeFile',
  'hasRedWordsFile',
  'isLocalResourceAvailable',
]
const allowedLocalLifecyclePrefixes = [
  'src/features/resources/',
  'src/features/onboarding/',
  'src/features/settings/DownloadsScreen.tsx',
  'src/features/settings/components/',
]
const sourceBoundaryRules = [
  {
    file: 'src/features/commentaries/CommentariesTabScreen.tsx',
    forbidden: ['~helpers/firebase', 'firebaseDb'],
    message: 'commentary content must be loaded through ResourceAccess',
  },
]

const violations = []
for (const file of (await Promise.all(sourceRoots.map(collectFiles))).flat()) {
  const relative = path.relative(root, file)
  const source = await readFile(file, 'utf8')

  for (const retiredModule of retiredModules) {
    if (source.includes(retiredModule)) {
      violations.push(`${relative}: retired Resource gate ${retiredModule} is forbidden`)
    }
  }

  if (!allowedLocalLifecyclePrefixes.some(prefix => relative.startsWith(prefix))) {
    for (const call of screenLevelAvailabilityCalls) {
      if (new RegExp(`\\b${call}\\b`).test(source)) {
        violations.push(
          `${relative}: ${call} must stay behind Resource access or Offline-copy lifecycle modules`
        )
      }
    }
  }

  for (const rule of sourceBoundaryRules.filter(rule => rule.file === relative)) {
    for (const forbidden of rule.forbidden) {
      if (source.includes(forbidden)) {
        violations.push(`${relative}: ${rule.message} (${forbidden})`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exitCode = 1
} else {
  console.log('Resource UI architecture boundaries are valid.')
}
