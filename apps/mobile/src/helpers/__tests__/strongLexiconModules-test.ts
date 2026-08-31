/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('react-native-zip-archive', () => ({ unzip: jest.fn() }))
jest.mock('../atomicResourceFile', () => ({
  installAtomicResourceFile: jest.fn(),
  restoreOrphanedResourceBackup: jest.fn(),
}))
jest.mock('../databaseTypes', () => ({ getSharedSqliteDirPath: () => '/sqlite' }))
jest.mock('../downloadResourceArtifact', () => ({ downloadResourceArtifact: jest.fn() }))
jest.mock('../fileIntegrity', () => ({ toNativeFilePath: (path: string) => path }))
jest.mock('../firebase', () => ({ cdnUrl: (path: string) => `https://assets.test/${path}` }))
jest.mock('../sqlite', () => ({ openSQLiteDatabase: jest.fn() }))

import type { SQLiteDatabase } from '../sqlite'
import { createOfflineCopyId } from '../offlineCopyId'
import { getMobileResourceCatalogEntry } from '../mobileResourceCatalog'
import { validateStrongLexiconModuleDatabase } from '../strongLexiconModules'

const getCatalogPublication = (moduleId: 'core' | 'resources') =>
  getMobileResourceCatalogEntry(createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId }))

const createCoreDatabase = ({
  schemaVersion = 3,
  additionalTables = [],
  additionalStepEntryColumns = [],
}: {
  schemaVersion?: number
  additionalTables?: string[]
  additionalStepEntryColumns?: string[]
} = {}) =>
  ({
    getFirstAsync: jest.fn(async (sql: string) =>
      sql.includes('quick_check') ? { quick_check: 'ok' } : { integrity_check: 'ok' }
    ),
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('foreign_key_check')) return []
      if (sql.includes('sqlite_schema')) {
        return [
          { name: 'DictionaryMeta' },
          { name: 'StepEntries' },
          { name: 'StepEntryIdentities' },
          { name: 'LexiconTranslations' },
          { name: 'LexiconNameMeanings' },
          { name: 'RelationKinds' },
          { name: 'LexiconRelations' },
          { name: 'MorphologyCodes' },
          { name: 'MorphologyCodeTranslations' },
          ...additionalTables.map(name => ({ name })),
        ]
      }

      if (sql.includes('table_info')) {
        const table = sql.match(/table_info\("([^"]+)"\)/u)?.[1]
        const columns: Record<string, string[]> = {
          DictionaryMeta: ['key', 'value'],
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
            ...additionalStepEntryColumns,
          ],
          StepEntryIdentities: ['stepEntryId', 'stepCode'],
          LexiconTranslations: ['stepEntryId', 'language', 'gloss', 'meaning', 'meaningHtml'],
          LexiconNameMeanings: [
            'stepEntryId',
            'language',
            'valueHtml',
            'valueText',
            'source',
            'sourceField',
            'sourceTextSha256',
            'translationEngine',
          ],
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
        }
        const integerColumns = new Set([
          'id',
          'baseCode',
          'stepEntryId',
          'morphologyCodeId',
          'fromStepEntryId',
          'toStepEntryId',
          'relationKindId',
          'sortOrder',
        ])
        return (columns[table ?? ''] ?? []).map(name => ({
          name,
          type: integerColumns.has(name) ? 'INTEGER' : 'TEXT',
          notnull: 1,
          pk: name === 'key' ? 1 : 0,
        }))
      }

      return [
        { key: 'moduleKind', value: 'core' },
        { key: 'moduleSchemaVersion', value: String(schemaVersion) },
        { key: 'resourceIdentity', value: 'strong-lexicon:core' },
        { key: 'resourceRevision', value: getCatalogPublication('core').resourceRevision },
      ]
    }),
  }) as unknown as SQLiteDatabase

const createResourcesDatabase = (
  additionalTables: string[] = [],
  additionalColumns: string[] = [],
  schemaVersion = 3
) =>
  ({
    getFirstAsync: jest.fn(async (sql: string) =>
      sql.includes('quick_check') ? { quick_check: 'ok' } : { integrity_check: 'ok' }
    ),
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('foreign_key_check')) return []
      if (sql.includes('sqlite_schema')) {
        return [
          { name: 'DictionaryMeta' },
          { name: 'LexiconResources' },
          { name: 'LexiconResourceTranslations' },
          ...additionalTables.map(name => ({ name })),
        ]
      }

      if (sql.includes('table_info')) {
        const table = sql.match(/table_info\("([^"]+)"\)/u)?.[1]
        const columns: Record<string, string[]> = {
          DictionaryMeta: ['key', 'value'],
          LexiconResources: [
            'id',
            'stepEntryId',
            'source',
            'kind',
            'contentHtml',
            ...additionalColumns,
          ],
          LexiconResourceTranslations: ['resourceId', 'language', 'contentHtml'],
        }
        return (columns[table ?? ''] ?? []).map(name => ({
          name,
          type: ['id', 'stepEntryId', 'resourceId'].includes(name) ? 'INTEGER' : 'TEXT',
          notnull: 1,
          pk: name === 'id' || name === 'key' ? 1 : 0,
        }))
      }

      return [
        { key: 'moduleKind', value: 'resources' },
        { key: 'moduleSchemaVersion', value: String(schemaVersion) },
        { key: 'resourceIdentity', value: 'strong-lexicon:resources' },
        {
          key: 'resourceRevision',
          value: getCatalogPublication('resources').resourceRevision,
        },
        { key: 'coreRevision', value: getCatalogPublication('resources').coreRevision },
      ]
    }),
  }) as unknown as SQLiteDatabase

describe('Strong lexicon module validation', () => {
  it('accepts the published schema 3 core with structured name meanings', async () => {
    await expect(
      validateStrongLexiconModuleDatabase('core', createCoreDatabase())
    ).resolves.toEqual({
      status: 'available',
      moduleId: 'core',
      revision: getCatalogPublication('core').resourceRevision,
      schemaVersion: 3,
    })
  })

  it('supports a quick integrity check for cached runtime availability reads', async () => {
    const database = createCoreDatabase()

    await validateStrongLexiconModuleDatabase('core', database, undefined, {
      integrityCheck: 'quick',
    })

    expect(database.getFirstAsync).toHaveBeenCalledWith('PRAGMA quick_check')
  })

  it('accepts future additive core tables, columns, and schema metadata', async () => {
    await expect(
      validateStrongLexiconModuleDatabase(
        'core',
        createCoreDatabase({
          schemaVersion: 4,
          additionalTables: ['FutureLexiconContent'],
          additionalStepEntryColumns: ['futureDisplayValue'],
        })
      )
    ).resolves.toEqual(expect.objectContaining({ status: 'available', schemaVersion: 4 }))
  })

  it('accepts an independently published resources revision with an available core', async () => {
    await expect(
      validateStrongLexiconModuleDatabase('resources', createResourcesDatabase(), async () => ({
        status: 'available',
        moduleId: 'core',
        revision: getCatalogPublication('core').resourceRevision,
        schemaVersion: 3,
      }))
    ).resolves.toEqual({
      status: 'available',
      moduleId: 'resources',
      revision: getCatalogPublication('resources').resourceRevision,
      schemaVersion: 3,
    })
  })

  it('still requires the core module before activating resources', async () => {
    await expect(
      validateStrongLexiconModuleDatabase('resources', createResourcesDatabase(), async () => ({
        status: 'missing',
        moduleId: 'core',
      }))
    ).resolves.toEqual({ status: 'core-missing', moduleId: 'resources' })
  })

  it('ignores SQLite-owned statistics tables created by ANALYZE', async () => {
    await expect(
      validateStrongLexiconModuleDatabase(
        'resources',
        createResourcesDatabase(['sqlite_stat1']),
        async () => ({
          status: 'available',
          moduleId: 'core',
          revision: getCatalogPublication('core').resourceRevision,
          schemaVersion: 3,
        })
      )
    ).resolves.toEqual(expect.objectContaining({ status: 'available', moduleId: 'resources' }))
  })

  it('accepts additive tables and columns in optional modules', async () => {
    await expect(
      validateStrongLexiconModuleDatabase(
        'resources',
        createResourcesDatabase(['FutureDictionaryContent'], ['futureDisplayValue'], 4),
        async () => ({
          status: 'available',
          moduleId: 'core',
          revision: getCatalogPublication('core').resourceRevision,
          schemaVersion: 3,
        })
      )
    ).resolves.toEqual(expect.objectContaining({ status: 'available', schemaVersion: 4 }))
  })
})
