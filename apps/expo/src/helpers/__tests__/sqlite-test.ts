/* eslint-disable import/first */

const mockDatabase = {
  execAsync: jest.fn((_sql: string) => Promise.resolve()),
  closeAsync: jest.fn(() => Promise.resolve()),
}
const mockDeleteAsync = jest.fn((_path: string, _options?: unknown) => Promise.resolve())

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 4_096 })),
  deleteAsync: (path: string, options?: unknown) => mockDeleteAsync(path, options),
}))
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => mockDatabase),
}))
jest.mock('../databases', () => ({
  databaseDictionnaireName: 'dictionnaire.sqlite',
  databaseMhyName: 'mhy.sqlite',
  databaseNaveName: 'nave.sqlite',
  databaseTresorName: 'tresor.sqlite',
  getDatabases: jest.fn(),
  getDbPath: () => '/documents/SQLite/fr/dictionnaire.sqlite',
  initLanguageDirs: jest.fn(async () => undefined),
}))
jest.mock('../atomicResourceFile', () => ({
  restoreOrphanedResourceBackup: jest.fn(async () => undefined),
}))
jest.mock('~helpers/agentObservability', () => ({
  appLogger: {
    measure: (_area: string, _event: string, callback: () => Promise<unknown>) => callback(),
    captureError: jest.fn(),
  },
}))

import { dbManager } from '../sqlite'

describe('language-aware SQLite resources', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('does not keep a connection its indexes failed on', async () => {
    mockDatabase.execAsync.mockRejectedValueOnce(
      new Error(
        "Call to function 'NativeDatabase.execAsync' has been rejected.\n→ Caused by: database disk image is malformed"
      )
    )
    const database = dbManager.getDB('DICTIONNAIRE', 'fr')

    await expect(database.init()).rejects.toThrow('malformed')
    expect(database.get()).toBeUndefined()
    expect(mockDatabase.closeAsync).toHaveBeenCalledTimes(1)
  })

  it('removes an unreadable copy with its journal and backup files', async () => {
    await dbManager.getDB('DICTIONNAIRE', 'fr').discardUnreadableCopy()

    expect(mockDeleteAsync.mock.calls.map(([path]) => path)).toEqual([
      '/documents/SQLite/fr/dictionnaire.sqlite',
      '/documents/SQLite/fr/dictionnaire.sqlite-journal',
      '/documents/SQLite/fr/dictionnaire.sqlite-wal',
      '/documents/SQLite/fr/dictionnaire.sqlite-shm',
      '/documents/SQLite/fr/dictionnaire.sqlite.backup',
    ])
  })
})
