import * as FileSystem from 'expo-file-system/legacy'
import { unzip } from 'react-native-zip-archive'

import { installAtomicResourceFile, restoreOrphanedResourceBackup } from './atomicResourceFile'
import { getSharedSqliteDirPath } from './databaseTypes'
import { downloadWithCdnFallback } from './downloadWithCdnFallback'
import { toNativeFilePath } from './fileIntegrity'
import { openSQLiteDatabase, type SQLiteDatabase } from './sqlite'
import {
  getStrongLexiconPublication,
  type StrongLexiconModuleId,
} from './strongLexiconPublications'
import type { ResourceInstallationLifecycle } from './resourceInstallationLifecycle'

export type StrongLexiconModuleAvailability =
  | { status: 'missing'; moduleId: StrongLexiconModuleId }
  | { status: 'core-missing'; moduleId: Exclude<StrongLexiconModuleId, 'core'> }
  | {
      status: 'incompatible'
      moduleId: StrongLexiconModuleId
      expectedRevision?: string
      installedRevision?: string
    }
  | { status: 'corrupt'; moduleId: StrongLexiconModuleId; reason: string }
  | {
      status: 'available'
      moduleId: StrongLexiconModuleId
      revision?: string
      schemaVersion: number
    }

export interface StrongLexiconInstallCallbacks {
  onDownloadProgress?: FileSystem.DownloadProgressCallback
  onResumable?: (resumable: FileSystem.DownloadResumable | null) => void
  onStatusInserting?: () => void
  onInsertProgress?: (progress: number) => void
  isCancelled?: () => boolean
  installationLifecycle?: ResourceInstallationLifecycle
}

const moduleDatabases = new Map<StrongLexiconModuleId, SQLiteDatabase>()
const validatedModules = new Map<StrongLexiconModuleId, StrongLexiconModuleAvailability>()

const REQUIRED_TABLES: Record<StrongLexiconModuleId, string[]> = {
  core: [
    'DictionaryMeta',
    'StepEntries',
    'StepEntryIdentities',
    'LexiconTranslations',
    'RelationKinds',
    'LexiconRelations',
    'MorphologyCodes',
    'MorphologyCodeTranslations',
  ],
  resources: ['DictionaryMeta', 'LexiconResources', 'LexiconResourceTranslations'],
  entities: [
    'EntityMeta',
    'Entities',
    'EntityTranslations',
    'EntityRefs',
    'EntityRelations',
    'EntityPlaces',
  ],
}

export const getStrongLexiconDirectory = (): string => `${getSharedSqliteDirPath()}/strong-lexicon`

export const getStrongLexiconModulePath = (moduleId: StrongLexiconModuleId): string =>
  `${getStrongLexiconDirectory()}/${getStrongLexiconPublication(moduleId).entry}`

const readKeyValueTable = async (
  database: SQLiteDatabase,
  table: 'DictionaryMeta' | 'EntityMeta'
): Promise<Record<string, string>> => {
  const rows = await database.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM ${table}`
  )
  return Object.fromEntries(rows.map(row => [row.key, row.value]))
}

const validateModuleDatabase = async (
  moduleId: StrongLexiconModuleId,
  database: SQLiteDatabase
): Promise<StrongLexiconModuleAvailability> => {
  const integrity = await database.getFirstAsync<{ integrity_check: string }>(
    'PRAGMA integrity_check'
  )
  if (integrity?.integrity_check !== 'ok') {
    throw new Error(`STRONG_LEXICON_INTEGRITY_FAILED:${moduleId}`)
  }

  const tables = await database.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_schema WHERE type='table'`
  )
  const tableNames = new Set(tables.map(table => table.name))
  const missingTable = REQUIRED_TABLES[moduleId].find(table => !tableNames.has(table))
  if (missingTable) {
    throw new Error(`STRONG_LEXICON_SCHEMA_MISMATCH:${moduleId}:${missingTable}`)
  }

  if (moduleId === 'entities') {
    return { status: 'available', moduleId, schemaVersion: 1 }
  }

  const metadata = await readKeyValueTable(database, 'DictionaryMeta')
  const schemaVersion = Number(metadata.moduleSchemaVersion ?? 0)
  const revision = metadata.lexiconRevision
  if (
    metadata.moduleKind !== moduleId ||
    schemaVersion !== getStrongLexiconPublication(moduleId).schemaVersion ||
    !revision
  ) {
    return {
      status: 'incompatible',
      moduleId,
      installedRevision: revision,
    }
  }

  if (moduleId === 'resources') {
    const core = await getStrongLexiconModuleAvailability('core')
    if (core.status !== 'available') {
      return { status: 'core-missing', moduleId }
    }
    if (core.revision !== revision) {
      return {
        status: 'incompatible',
        moduleId,
        expectedRevision: core.revision,
        installedRevision: revision,
      }
    }
  }

  return { status: 'available', moduleId, revision, schemaVersion }
}

const openInstalledModule = async (
  moduleId: StrongLexiconModuleId
): Promise<SQLiteDatabase | null> => {
  const existing = moduleDatabases.get(moduleId)
  if (existing) return existing

  const path = getStrongLexiconModulePath(moduleId)
  await restoreOrphanedResourceBackup(path, `${path}.backup`)
  const file = await FileSystem.getInfoAsync(path)
  if (!file.exists || file.size === 0) return null

  const publication = getStrongLexiconPublication(moduleId)
  const database = await openSQLiteDatabase(
    publication.entry,
    { useNewConnection: true },
    getStrongLexiconDirectory()
  )
  moduleDatabases.set(moduleId, database)
  return database
}

export const getStrongLexiconModuleAvailability = async (
  moduleId: StrongLexiconModuleId
): Promise<StrongLexiconModuleAvailability> => {
  const cached = validatedModules.get(moduleId)
  if (cached) return cached

  try {
    const database = await openInstalledModule(moduleId)
    if (!database) return { status: 'missing', moduleId }
    const availability = await validateModuleDatabase(moduleId, database)
    validatedModules.set(moduleId, availability)
    return availability
  } catch (error) {
    const availability: StrongLexiconModuleAvailability = {
      status: 'corrupt',
      moduleId,
      reason: error instanceof Error ? error.message : String(error),
    }
    validatedModules.set(moduleId, availability)
    return availability
  }
}

export const getStrongLexiconDatabase = async (
  moduleId: StrongLexiconModuleId
): Promise<SQLiteDatabase> => {
  const availability = await getStrongLexiconModuleAvailability(moduleId)
  if (availability.status !== 'available') {
    throw new Error(`STRONG_LEXICON_MODULE_${availability.status.toUpperCase()}:${moduleId}`)
  }
  const database = await openInstalledModule(moduleId)
  if (!database) throw new Error(`STRONG_LEXICON_MODULE_MISSING:${moduleId}`)
  return database
}

export const getOptionalStrongLexiconDatabase = async (
  moduleId: Exclude<StrongLexiconModuleId, 'core'>
): Promise<SQLiteDatabase | null> => {
  const availability = await getStrongLexiconModuleAvailability(moduleId)
  if (availability.status !== 'available') return null
  return openInstalledModule(moduleId)
}

export const closeStrongLexiconModule = async (moduleId: StrongLexiconModuleId): Promise<void> => {
  validatedModules.delete(moduleId)
  if (moduleId === 'core') {
    validatedModules.delete('resources')
    validatedModules.delete('entities')
  }
  const database = moduleDatabases.get(moduleId)
  moduleDatabases.delete(moduleId)
  await database?.closeAsync()
}

const activateStrongLexiconModule = async (
  moduleId: StrongLexiconModuleId,
  extractedPath: string,
  beforeCommit?: () => void | Promise<void>
): Promise<void> => {
  const destinationPath = getStrongLexiconModulePath(moduleId)
  await installAtomicResourceFile({
    candidatePath: extractedPath,
    destinationPath,
    beforeSwap: () => closeStrongLexiconModule(moduleId),
    afterSwap: async () => {
      const availability = await getStrongLexiconModuleAvailability(moduleId)
      if (availability.status !== 'available') {
        throw new Error(`STRONG_LEXICON_ACTIVATION_FAILED:${moduleId}:${availability.status}`)
      }
      await beforeCommit?.()
    },
    beforeRollback: () => closeStrongLexiconModule(moduleId),
  })
}

export const installStrongLexiconModule = async (
  moduleId: StrongLexiconModuleId,
  callbacks: StrongLexiconInstallCallbacks = {}
) => {
  const publication = getStrongLexiconPublication(moduleId)
  const archivePath = `${FileSystem.cacheDirectory}strong-lexicon-${moduleId}.zip`
  const extractionDirectory = `${FileSystem.cacheDirectory}strong-lexicon-${moduleId}/`
  const extractedPath = `${extractionDirectory}${publication.entry}`
  try {
    const result = await downloadWithCdnFallback({
      url: publication.url,
      destinationPath: archivePath,
      downloadOptions: { cache: false },
      onDownloadProgress: callbacks.onDownloadProgress,
      onResumable: callbacks.onResumable,
      isCancelled: callbacks.isCancelled,
      logTag: `StrongLexicon:${moduleId}`,
    })
    if (callbacks.isCancelled?.()) throw new Error('CANCELLED')
    await callbacks.installationLifecycle?.prepare(result)

    callbacks.onStatusInserting?.()
    callbacks.onInsertProgress?.(0)
    await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
    await FileSystem.makeDirectoryAsync(extractionDirectory, { intermediates: true })
    callbacks.onInsertProgress?.(0.15)
    await unzip(toNativeFilePath(archivePath), toNativeFilePath(extractionDirectory), 'UTF-8')
    callbacks.onInsertProgress?.(0.6)
    callbacks.onInsertProgress?.(0.8)
    await FileSystem.makeDirectoryAsync(getStrongLexiconDirectory(), { intermediates: true })
    await activateStrongLexiconModule(moduleId, extractedPath, () =>
      callbacks.installationLifecycle?.commit(result)
    )
    callbacks.onInsertProgress?.(1)
    return result
  } finally {
    callbacks.onResumable?.(null)
    await FileSystem.deleteAsync(archivePath, { idempotent: true })
    await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
  }
}

export const removeStrongLexiconModule = async (moduleId: StrongLexiconModuleId): Promise<void> => {
  await closeStrongLexiconModule(moduleId)
  await FileSystem.deleteAsync(getStrongLexiconModulePath(moduleId), { idempotent: true })
}
