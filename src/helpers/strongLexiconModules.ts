import * as FileSystem from 'expo-file-system/legacy'
import { unzip } from 'react-native-zip-archive'

import { installAtomicResourceFile, restoreOrphanedResourceBackup } from './atomicResourceFile'
import { AsyncConnectionRegistry } from './asyncConnectionRegistry'
import { getSharedSqliteDirPath } from './databaseTypes'
import { downloadWithCdnFallback } from './downloadWithCdnFallback'
import { toNativeFilePath, verifyFileSha256 } from './fileIntegrity'
import { createOfflineCopyId } from './offlineCopyId'
import { getMobileResourceCatalogEntry } from './mobileResourceCatalog'
import {
  MAX_STRONG_LEXICON_ARCHIVE_BYTES,
  validateBoundedZipArchive,
  type BoundedZipEntryContract,
} from './zipArchiveValidation'
import { openSQLiteDatabase, type SQLiteDatabase } from './sqlite'
import {
  getStrongLexiconPublication,
  type StrongLexiconModuleId,
  type StrongLexiconPublicationArtifact,
} from './strongLexiconPublications'
import type { ResourceInstallationLifecycle } from './resourceInstallationLifecycle'

export type StrongLexiconModuleAvailability =
  | { status: 'missing'; moduleId: StrongLexiconModuleId }
  | { status: 'core-missing'; moduleId: Exclude<StrongLexiconModuleId, 'core'> }
  | {
      status: 'incompatible'
      moduleId: StrongLexiconModuleId
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

class StrongLexiconModuleMissingError extends Error {}

const ensureStrongLexiconQueryIndexes = async (
  moduleId: StrongLexiconModuleId,
  database: SQLiteDatabase
): Promise<void> => {
  if (moduleId === 'core') {
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS StepEntries_browse_idx
        ON StepEntries(language, gloss COLLATE NOCASE, baseCode, id);
      CREATE INDEX IF NOT EXISTS StepEntries_random_idx
        ON StepEntries(language, id) WHERE gloss <> '';
      CREATE INDEX IF NOT EXISTS StepEntryIdentities_entry_idx
        ON StepEntryIdentities(stepEntryId, stepCode);
      CREATE INDEX IF NOT EXISTS LexiconTranslations_browse_idx
        ON LexiconTranslations(language, gloss COLLATE NOCASE, stepEntryId);
      CREATE INDEX IF NOT EXISTS LexiconRelations_from_idx
        ON LexiconRelations(fromStepEntryId, sortOrder);
      CREATE INDEX IF NOT EXISTS MorphologyCodes_lookup_idx
        ON MorphologyCodes(normalizedCode COLLATE NOCASE, code COLLATE NOCASE);
    `)
  } else if (moduleId === 'resources') {
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS LexiconResources_entry_idx
        ON LexiconResources(stepEntryId, id);
      CREATE INDEX IF NOT EXISTS LexiconResourceTranslations_lookup_idx
        ON LexiconResourceTranslations(resourceId, language);
    `)
  } else {
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS Entities_ustrong_idx ON Entities(uStrong, id);
      CREATE INDEX IF NOT EXISTS EntityTranslations_lookup_idx
        ON EntityTranslations(entityId, language);
      CREATE INDEX IF NOT EXISTS EntityRefs_chapter_idx
        ON EntityRefs(book, chapter, entityId, verse);
      CREATE INDEX IF NOT EXISTS EntityRelations_from_idx
        ON EntityRelations(fromEntityId, relation, toEntityId);
    `)
  }
}

const moduleConnections = new AsyncConnectionRegistry<StrongLexiconModuleId, SQLiteDatabase>(
  async moduleId => {
    const path = getStrongLexiconModulePath(moduleId)
    await restoreOrphanedResourceBackup(path, `${path}.backup`)
    const file = await FileSystem.getInfoAsync(path)
    if (!file.exists || file.size === 0) {
      throw new StrongLexiconModuleMissingError()
    }

    const publication = getStrongLexiconPublication(moduleId)
    const database = await openSQLiteDatabase(
      publication.entry,
      { useNewConnection: true },
      getStrongLexiconDirectory()
    )
    await ensureStrongLexiconQueryIndexes(moduleId, database)
    return database
  },
  database => database.closeAsync()
)
const validatedModules = new Map<StrongLexiconModuleId, StrongLexiconModuleAvailability>()

const getExpectedStrongLexiconPublication = (
  moduleId: StrongLexiconModuleId
): StrongLexiconPublicationArtifact => {
  const publication = getStrongLexiconPublication(moduleId)
  const catalog = getMobileResourceCatalogEntry(
    createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId })
  )
  return {
    ...publication,
    resourceRevision: catalog.resourceRevision ?? publication.resourceRevision,
    ...(catalog.coreRevision || publication.coreRevision
      ? { coreRevision: catalog.coreRevision ?? publication.coreRevision }
      : {}),
  }
}

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

const REQUIRED_TABLE_COLUMNS: Record<StrongLexiconModuleId, Record<string, string[]>> = {
  core: {
    StepEntries: [
      'id',
      'language',
      'baseCode',
      'eStrong',
      'dStrong',
      'uStrong',
      'original',
      'transliteration',
      'morph',
      'gloss',
      'meaning',
      'classicTransliteration',
      'pronunciation',
    ],
    StepEntryIdentities: ['stepEntryId', 'stepCode'],
    LexiconTranslations: ['stepEntryId', 'language', 'gloss', 'meaning', 'meaningHtml'],
    RelationKinds: ['id', 'kind', 'labelEn', 'labelFr'],
    LexiconRelations: [
      'id',
      'fromStepEntryId',
      'toStepEntryId',
      'toStepCode',
      'groupKind',
      'relationKindId',
      'sortOrder',
    ],
    MorphologyCodes: [
      'id',
      'code',
      'normalizedCode',
      'language',
      'scope',
      'meaning',
      'description',
    ],
    MorphologyCodeTranslations: ['morphologyCodeId', 'language', 'meaning', 'description'],
  },
  resources: {
    LexiconResources: ['id', 'stepEntryId', 'source', 'kind', 'contentHtml'],
    LexiconResourceTranslations: ['resourceId', 'language', 'contentHtml'],
  },
  entities: {
    Entities: [
      'id',
      'uniqueName',
      'uStrong',
      'displayName',
      'category',
      'type',
      'description',
      'summaryHtml',
      'briefest',
      'brief',
      'shortDescription',
      'articleHtml',
    ],
    EntityTranslations: [
      'id',
      'entityId',
      'language',
      'displayName',
      'description',
      'summaryHtml',
      'briefest',
      'brief',
      'shortDescription',
      'articleHtml',
    ],
    EntityRefs: ['entityId', 'book', 'chapter', 'verse', 'suffix', 'refText'],
    EntityRelations: ['fromEntityId', 'relation', 'toUniqueName', 'toEntityId', 'certainty'],
    EntityPlaces: [
      'entityId',
      'openBibleName',
      'googleMapUrl',
      'palopenmapsUrl',
      'latitude',
      'longitude',
      'area',
    ],
  },
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

export const validateStrongLexiconModuleDatabase = async (
  moduleId: StrongLexiconModuleId,
  database: SQLiteDatabase,
  getCoreAvailability: () => Promise<StrongLexiconModuleAvailability> = () =>
    getStrongLexiconModuleAvailability('core')
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
  const allowedTables = new Set([
    ...REQUIRED_TABLES[moduleId],
    'sqlite_sequence',
    ...(moduleId === 'entities' ? ['EntityNames', 'EntityTranslationProvenance'] : []),
  ])
  if (tables.some(table => !allowedTables.has(table.name))) {
    throw new Error(`STRONG_LEXICON_SCHEMA_MISMATCH:${moduleId}:unexpected-table`)
  }
  const metadataTable = moduleId === 'entities' ? 'EntityMeta' : 'DictionaryMeta'
  const metadataColumns = await database.getAllAsync<{
    name: string
    type: string
    notnull: number
    pk: number
  }>(`PRAGMA table_info("${metadataTable}")`)
  if (
    metadataColumns.length !== 2 ||
    metadataColumns.map(column => column.name).join('|') !== 'key|value' ||
    metadataColumns.some(
      column =>
        column.type.toUpperCase() !== 'TEXT' ||
        column.notnull !== 1 ||
        (column.name === 'key' && column.pk !== 1) ||
        (column.name === 'value' && column.pk !== 0)
    )
  ) {
    throw new Error(`STRONG_LEXICON_SCHEMA_MISMATCH:${moduleId}:metadata`)
  }
  if ((await database.getAllAsync('PRAGMA foreign_key_check')).length > 0) {
    throw new Error(`STRONG_LEXICON_FOREIGN_KEY_FAILED:${moduleId}`)
  }
  for (const table of REQUIRED_TABLES[moduleId].filter(table => !table.endsWith('Meta'))) {
    const columns = await database.getAllAsync<{
      name: string
      type: string
      notnull: number
      pk: number
    }>(`PRAGMA table_info("${table}")`)
    const expected = REQUIRED_TABLE_COLUMNS[moduleId][table]
    if (
      columns.length === 0 ||
      columns
        .map(column => column.name)
        .sort()
        .join('|') !== [...expected].sort().join('|')
    ) {
      throw new Error(`STRONG_LEXICON_SCHEMA_COLUMNS_MISMATCH:${moduleId}:${table}`)
    }
    for (const column of columns) {
      const integerColumns = new Set([
        'id',
        'baseCode',
        'stepEntryId',
        'resourceId',
        'morphologyCodeId',
        'entityId',
        'fromStepEntryId',
        'toStepEntryId',
        'fromEntityId',
        'toEntityId',
        'relationKindId',
        'sortOrder',
        'chapter',
        'verse',
      ])
      const realColumns = new Set(['latitude', 'longitude'])
      const optionalColumns = new Set(['toStepEntryId', 'toEntityId', 'latitude', 'longitude'])
      const expectedType = realColumns.has(column.name)
        ? 'REAL'
        : integerColumns.has(column.name)
          ? 'INTEGER'
          : 'TEXT'
      if (column.type.toUpperCase() !== expectedType) {
        throw new Error(`STRONG_LEXICON_SCHEMA_COLUMNS_MISMATCH:${moduleId}:${table}`)
      }
      if (!optionalColumns.has(column.name) && column.pk === 0 && column.notnull !== 1) {
        throw new Error(`STRONG_LEXICON_SCHEMA_NULLABILITY_MISMATCH:${moduleId}:${table}`)
      }
    }
  }

  const metadata = await readKeyValueTable(
    database,
    moduleId === 'entities' ? 'EntityMeta' : 'DictionaryMeta'
  )
  const publication = getExpectedStrongLexiconPublication(moduleId)
  const schemaVersion = Number(metadata.moduleSchemaVersion ?? 0)
  const revision = metadata.resourceRevision
  if (
    metadata.moduleKind !== moduleId ||
    metadata.resourceIdentity !== `strong-lexicon:${moduleId}` ||
    schemaVersion !== publication.schemaVersion ||
    revision !== publication.resourceRevision ||
    (moduleId !== 'core' && metadata.coreRevision !== publication.coreRevision)
  ) {
    return {
      status: 'incompatible',
      moduleId,
      installedRevision: revision,
    }
  }

  if (moduleId !== 'core') {
    const core = await getCoreAvailability()
    if (core.status !== 'available') {
      return { status: 'core-missing', moduleId }
    }
    if (core.revision !== publication.coreRevision) {
      return { status: 'incompatible', moduleId, installedRevision: revision }
    }
  }

  return { status: 'available', moduleId, revision, schemaVersion }
}

const withInstalledModule = async <Result>(
  moduleId: StrongLexiconModuleId,
  operation: (database: SQLiteDatabase) => Promise<Result>
): Promise<{ found: false } | { found: true; result: Result }> => {
  try {
    return {
      found: true,
      result: await moduleConnections.use(moduleId, operation),
    }
  } catch (error) {
    if (error instanceof StrongLexiconModuleMissingError) return { found: false }
    throw error
  }
}

export const getStrongLexiconModuleAvailability = async (
  moduleId: StrongLexiconModuleId
): Promise<StrongLexiconModuleAvailability> => {
  const cached = validatedModules.get(moduleId)
  if (cached) return cached

  try {
    const installedModule = await withInstalledModule(moduleId, async database => {
      try {
        const availability = await validateStrongLexiconModuleDatabase(moduleId, database)
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
    })
    if (!installedModule.found) return { status: 'missing', moduleId }
    return installedModule.result
  } catch (error) {
    return {
      status: 'corrupt',
      moduleId,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

export const withStrongLexiconDatabase = async <Result>(
  moduleId: StrongLexiconModuleId,
  operation: (database: SQLiteDatabase) => Promise<Result>
): Promise<Result> => {
  const availability = await getStrongLexiconModuleAvailability(moduleId)
  if (availability.status !== 'available') {
    throw new Error(`STRONG_LEXICON_MODULE_${availability.status.toUpperCase()}:${moduleId}`)
  }
  const installedModule = await withInstalledModule(moduleId, operation)
  if (!installedModule.found) throw new Error(`STRONG_LEXICON_MODULE_MISSING:${moduleId}`)
  return installedModule.result
}

export const withOptionalStrongLexiconDatabase = async <Result>(
  moduleId: Exclude<StrongLexiconModuleId, 'core'>,
  operation: (database: SQLiteDatabase) => Promise<Result>
): Promise<Result | null> => {
  const availability = await getStrongLexiconModuleAvailability(moduleId)
  if (availability.status !== 'available') return null
  const installedModule = await withInstalledModule(moduleId, operation)
  return installedModule.found ? installedModule.result : null
}

export const closeStrongLexiconModule = async (moduleId: StrongLexiconModuleId): Promise<void> => {
  await moduleConnections.withExclusiveAccess(moduleId, async () => {
    invalidateStrongLexiconValidation(moduleId)
  })
}

const invalidateStrongLexiconValidation = (moduleId: StrongLexiconModuleId): void => {
  validatedModules.delete(moduleId)
  if (moduleId === 'core') {
    validatedModules.delete('resources')
    validatedModules.delete('entities')
  }
}

const decodeBase64 = (value: string): Uint8Array => {
  const binary = globalThis.atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

const readBoundedArchive = async (
  archivePath: string,
  contract: BoundedZipEntryContract
): Promise<void> => {
  const info = await FileSystem.getInfoAsync(archivePath)
  if (
    !info.exists ||
    info.isDirectory ||
    (info.size ?? Number.POSITIVE_INFINITY) > MAX_STRONG_LEXICON_ARCHIVE_BYTES ||
    info.size !== contract.archiveBytes ||
    !Number.isSafeInteger(info.size)
  ) {
    throw new Error('STRONG_LEXICON_ARCHIVE_SIZE_MISMATCH')
  }
  const encoded = await FileSystem.readAsStringAsync(archivePath, { encoding: 'base64' })
  validateBoundedZipArchive(decodeBase64(encoded), contract)
}

const activateStrongLexiconModule = async (
  moduleId: StrongLexiconModuleId,
  extractedPath: string,
  beforeCommit?: () => void | Promise<void>
): Promise<void> => {
  const destinationPath = getStrongLexiconModulePath(moduleId)
  await moduleConnections.withExclusiveAccess(moduleId, async () => {
    invalidateStrongLexiconValidation(moduleId)
    await installAtomicResourceFile({
      candidatePath: extractedPath,
      destinationPath,
      afterSwap: beforeCommit,
    })
  })
}

export const installStrongLexiconModule = async (
  moduleId: StrongLexiconModuleId,
  publication: StrongLexiconPublicationArtifact,
  callbacks: StrongLexiconInstallCallbacks = {}
) => {
  const archivePath = `${FileSystem.cacheDirectory}strong-lexicon-${moduleId}.zip`
  const extractionDirectory = `${FileSystem.cacheDirectory}strong-lexicon-${moduleId}/`
  const extractedPath = `${extractionDirectory}${publication.entry}`
  try {
    const expectedPublication = getExpectedStrongLexiconPublication(moduleId)
    if (
      publication.id !== moduleId ||
      publication.entry !== expectedPublication.entry ||
      publication.schemaVersion !== expectedPublication.schemaVersion ||
      publication.resourceRevision !== expectedPublication.resourceRevision ||
      publication.coreRevision !== expectedPublication.coreRevision
    ) {
      throw new Error(`STRONG_LEXICON_PUBLICATION_IDENTITY_MISMATCH:${moduleId}`)
    }
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
    await readBoundedArchive(archivePath, {
      entry: publication.entry,
      archiveBytes: publication.archiveBytes,
      contentBytes: publication.contentBytes,
    })
    if (publication.archiveSha256) {
      await verifyFileSha256(
        archivePath,
        publication.archiveSha256,
        `STRONG_LEXICON_ARCHIVE_CHECKSUM_MISMATCH:${moduleId}`
      )
    }
    await callbacks.installationLifecycle?.prepare(result)

    callbacks.onStatusInserting?.()
    callbacks.onInsertProgress?.(0)
    await FileSystem.deleteAsync(extractionDirectory, { idempotent: true })
    await FileSystem.makeDirectoryAsync(extractionDirectory, { intermediates: true })
    callbacks.onInsertProgress?.(0.15)
    await unzip(toNativeFilePath(archivePath), toNativeFilePath(extractionDirectory), 'UTF-8')
    const extractedEntries = await FileSystem.readDirectoryAsync(extractionDirectory)
    if (extractedEntries.length !== 1 || extractedEntries[0] !== publication.entry) {
      throw new Error(`STRONG_LEXICON_ARCHIVE_ENTRIES_INVALID:${moduleId}`)
    }
    const extractedInfo = await FileSystem.getInfoAsync(extractedPath)
    if (
      !extractedInfo.exists ||
      extractedInfo.isDirectory ||
      extractedInfo.size !== publication.contentBytes
    ) {
      throw new Error(`STRONG_LEXICON_CONTENT_SIZE_MISMATCH:${moduleId}`)
    }
    await verifyFileSha256(
      extractedPath,
      publication.contentSha256,
      `STRONG_LEXICON_CONTENT_CHECKSUM_MISMATCH:${moduleId}`
    )
    callbacks.onInsertProgress?.(0.6)
    const candidate = await openSQLiteDatabase(
      publication.entry,
      { useNewConnection: true },
      extractionDirectory
    )
    try {
      const availability = await validateStrongLexiconModuleDatabase(moduleId, candidate)
      if (availability.status !== 'available') {
        throw new Error(`STRONG_LEXICON_ACTIVATION_FAILED:${moduleId}:${availability.status}`)
      }
    } finally {
      await candidate.closeAsync()
    }
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
  await moduleConnections.withExclusiveAccess(moduleId, async () => {
    invalidateStrongLexiconValidation(moduleId)
    await FileSystem.deleteAsync(getStrongLexiconModulePath(moduleId), { idempotent: true })
  })
}
