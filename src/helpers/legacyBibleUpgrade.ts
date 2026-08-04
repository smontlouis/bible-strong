import * as FileSystem from 'expo-file-system/legacy'

import { storage } from './storage'
import { migrateLegacyDownloadQueue } from './legacyBibleVersionMigration'

const CLEANUP_KEY = 'hasCleanedLegacyBibleResourcesV1'

type MigrationStorage = {
  getBoolean(key: string): boolean | undefined
  getString(key: string): string | undefined
  set(key: string, value: string | boolean): void
  remove(key: string): void
}

export type LegacyBibleMigrationTerminalOutcome = 'completed' | 'abandoned-after-failure'

export type LegacyBibleCleanupResult =
  | 'awaiting-terminal-outcome'
  | 'cleanup-already-completed'
  | 'cleanup-completed'

const withTemporaryFiles = (path: string): string[] => [path, `${path}.download`, `${path}.backup`]

const withSqliteCompanionFiles = (path: string): string[] => [
  ...withTemporaryFiles(path),
  `${path}-wal`,
  `${path}-shm`,
  `${path}-journal`,
]

export const getLegacyBibleResourcePaths = (
  documentDirectory = FileSystem.documentDirectory ?? ''
): string[] => {
  const sqliteDirectory = `${documentDirectory}SQLite`
  const bibleFiles = ['LSGS', 'KJVS'].flatMap(versionId => [
    ...withTemporaryFiles(`${documentDirectory}bible-${versionId}.json`),
    ...withTemporaryFiles(`${documentDirectory}bible-${versionId.toLowerCase()}.json`),
    ...withTemporaryFiles(`${documentDirectory}bible-${versionId.toLowerCase()}-pericope.json`),
    ...withTemporaryFiles(`${documentDirectory}red-words-${versionId}.json`),
    ...withTemporaryFiles(`${documentDirectory}red-words-${versionId.toLowerCase()}.json`),
  ])
  const obsoleteDatabaseFiles = ['interlineaire.sqlite', 'strong.sqlite'].flatMap(fileName =>
    [
      `${sqliteDirectory}/${fileName}`,
      `${sqliteDirectory}/fr/${fileName}`,
      `${sqliteDirectory}/en/${fileName}`,
    ].flatMap(withSqliteCompanionFiles)
  )

  return [...new Set([...bibleFiles, ...obsoleteDatabaseFiles])]
}

const LEGACY_PUBLICATION_KEYS = [
  'resource-publication:bible:LSGS',
  'resource-publication:bible:KJVS',
  'resource-publication:bible:INT',
  'resource-publication:bible:INT_EN',
  'resource-publication:bible-pericope:LSGS',
  'resource-publication:bible-pericope:KJVS',
  'resource-publication:bible-red-words:LSGS',
  'resource-publication:bible-red-words:KJVS',
  'resource-publication:database:INTERLINEAIRE:fr',
  'resource-publication:database:INTERLINEAIRE:en',
  'resource-publication:database:STRONG:fr',
  'resource-publication:database:STRONG:en',
]

export const cleanupLegacyBibleResources = async ({
  terminalOutcome,
  storage: backend = storage,
  deleteFile = (path: string) => FileSystem.deleteAsync(path, { idempotent: true }),
}: {
  terminalOutcome?: LegacyBibleMigrationTerminalOutcome
  storage?: MigrationStorage
  deleteFile?: (path: string) => Promise<void>
} = {}): Promise<LegacyBibleCleanupResult> => {
  if (!terminalOutcome) return 'awaiting-terminal-outcome'
  if (backend.getBoolean(CLEANUP_KEY)) return 'cleanup-already-completed'

  await Promise.all(getLegacyBibleResourcePaths().map(deleteFile))

  const persistedQueue = backend.getString('downloadQueue')
  if (persistedQueue) {
    backend.set('downloadQueue', migrateLegacyDownloadQueue(persistedQueue))
  }
  for (const key of LEGACY_PUBLICATION_KEYS) {
    backend.remove(key)
  }
  backend.set(CLEANUP_KEY, true)
  return 'cleanup-completed'
}
