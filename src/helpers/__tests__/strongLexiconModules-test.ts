/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('react-native-zip-archive', () => ({ unzip: jest.fn() }))
jest.mock('../atomicResourceFile', () => ({
  installAtomicResourceFile: jest.fn(),
  restoreOrphanedResourceBackup: jest.fn(),
}))
jest.mock('../databaseTypes', () => ({ getSharedSqliteDirPath: () => '/sqlite' }))
jest.mock('../downloadWithCdnFallback', () => ({ downloadWithCdnFallback: jest.fn() }))
jest.mock('../fileIntegrity', () => ({ toNativeFilePath: (path: string) => path }))
jest.mock('../firebase', () => ({ cdnUrl: (path: string) => `https://assets.test/${path}` }))
jest.mock('../sqlite', () => ({ openSQLiteDatabase: jest.fn() }))

import type { SQLiteDatabase } from '../sqlite'
import { validateStrongLexiconModuleDatabase } from '../strongLexiconModules'

const createResourcesDatabase = (revision: string) =>
  ({
    getFirstAsync: jest.fn(async () => ({ integrity_check: 'ok' })),
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('sqlite_schema')) {
        return [
          { name: 'DictionaryMeta' },
          { name: 'LexiconResources' },
          { name: 'LexiconResourceTranslations' },
        ]
      }

      return [
        { key: 'moduleKind', value: 'resources' },
        { key: 'moduleSchemaVersion', value: '2' },
        { key: 'lexiconRevision', value: revision },
      ]
    }),
  }) as unknown as SQLiteDatabase

describe('Strong lexicon module validation', () => {
  it('accepts an independently published resources revision with an available core', async () => {
    await expect(
      validateStrongLexiconModuleDatabase(
        'resources',
        createResourcesDatabase('resources-revision-2'),
        async () => ({
          status: 'available',
          moduleId: 'core',
          revision: 'core-revision-1',
          schemaVersion: 2,
        })
      )
    ).resolves.toEqual({
      status: 'available',
      moduleId: 'resources',
      revision: 'resources-revision-2',
      schemaVersion: 2,
    })
  })

  it('still requires the core module before activating resources', async () => {
    await expect(
      validateStrongLexiconModuleDatabase(
        'resources',
        createResourcesDatabase('resources-revision-2'),
        async () => ({ status: 'missing', moduleId: 'core' })
      )
    ).resolves.toEqual({ status: 'core-missing', moduleId: 'resources' })
  })
})
