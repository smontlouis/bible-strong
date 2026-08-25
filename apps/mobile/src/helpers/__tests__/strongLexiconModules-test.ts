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

const createResourcesDatabase = (additionalTables: string[] = []) =>
  ({
    getFirstAsync: jest.fn(async () => ({ integrity_check: 'ok' })),
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
          LexiconResources: ['id', 'stepEntryId', 'source', 'kind', 'contentHtml'],
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
        { key: 'moduleSchemaVersion', value: '2' },
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
  it('accepts an independently published resources revision with an available core', async () => {
    await expect(
      validateStrongLexiconModuleDatabase('resources', createResourcesDatabase(), async () => ({
        status: 'available',
        moduleId: 'core',
        revision: getCatalogPublication('core').resourceRevision,
        schemaVersion: 2,
      }))
    ).resolves.toEqual({
      status: 'available',
      moduleId: 'resources',
      revision: getCatalogPublication('resources').resourceRevision,
      schemaVersion: 2,
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
          schemaVersion: 2,
        })
      )
    ).resolves.toEqual(expect.objectContaining({ status: 'available', moduleId: 'resources' }))
  })

  it('still rejects unknown application tables', async () => {
    await expect(
      validateStrongLexiconModuleDatabase(
        'resources',
        createResourcesDatabase(['UnexpectedContent']),
        async () => ({
          status: 'available',
          moduleId: 'core',
          revision: getCatalogPublication('core').resourceRevision,
          schemaVersion: 2,
        })
      )
    ).rejects.toThrow('STRONG_LEXICON_SCHEMA_MISMATCH:resources:unexpected-table')
  })
})
