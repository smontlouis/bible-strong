/* eslint-disable import/first */

const mockTransaction = {
  execAsync: jest.fn((_sql: string) => Promise.resolve()),
  runAsync: jest.fn((_sql: string, _params?: unknown) => Promise.resolve()),
}
const mockDatabase = {
  execAsync: jest.fn((_sql: string) => Promise.resolve()),
  runAsync: jest.fn((_sql: string, _params?: unknown) => Promise.resolve()),
  getAllAsync: jest.fn(
    (_sql: string, _params?: unknown): Promise<unknown[]> => Promise.resolve([])
  ),
  getFirstAsync: jest.fn(
    (_sql: string, _params?: unknown): Promise<unknown> => Promise.resolve(null)
  ),
  withExclusiveTransactionAsync: jest.fn(
    async (task: (txn: typeof mockTransaction) => Promise<void>) => task(mockTransaction)
  ),
}
const mockOpenDatabaseAsync = jest.fn((..._args: unknown[]) => Promise.resolve(mockDatabase))
const mockWarn = jest.fn()

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  makeDirectoryAsync: jest.fn(),
}))
jest.mock('@sentry/react-native', () => ({
  withScope: jest.fn(),
  captureException: jest.fn(),
}))
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args),
}))
jest.mock('~helpers/databaseTypes', () => ({
  getSharedSqliteDirPath: () => '/documents/SQLite/shared',
}))
jest.mock('~helpers/databases', () => ({ databaseBiblesName: 'bibles.sqlite' }))
jest.mock('~helpers/bibleVersions', () => ({ versions: {} }))
jest.mock('~helpers/agentObservability', () => ({
  appLogger: { warn: (...args: unknown[]) => mockWarn(...args) },
}))

import { getInstalledVersions, insertBibleVersion, removeBibleVersion } from '../biblesDb'

const lsg = { '1': { '1': { '1': 'Au commencement, Dieu créa les cieux et la terre.' } } }
const sqlOf = (mock: jest.Mock) => mock.mock.calls.map(([sql]) => String(sql).trim())

describe('Bible SQLite writes', () => {
  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    // Opening sets up the schema on the main connection.
    await getInstalledVersions()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockDatabase.withExclusiveTransactionAsync.mockImplementation(async task =>
      task(mockTransaction)
    )
  })

  it('replaces a version inside its own transaction connection', async () => {
    await insertBibleVersion('LSG', lsg)

    expect(mockDatabase.runAsync).not.toHaveBeenCalled()
    const statements = sqlOf(mockTransaction.runAsync)
    expect(statements[0]).toMatch(/^INSERT INTO verses_fts\(verses_fts, rowid/)
    expect(statements[1]).toBe('DELETE FROM verses WHERE version = ?')
    expect(statements.some(sql => sql.startsWith('INSERT INTO verses ('))).toBe(true)
    expect(statements.at(-1)).toMatch(/^INSERT INTO versions_meta/)
    expect(sqlOf(mockTransaction.execAsync)[0]).toMatch(/^PRAGMA busy_timeout/)
  })

  it('rebuilds a search index left behind by an interrupted install, then goes on', async () => {
    mockTransaction.runAsync.mockRejectedValueOnce(
      new Error(
        "Call to function 'NativeStatement.finalizeAsync' has been rejected.\n→ Caused by: Error code 11: database disk image is malformed"
      )
    )

    await insertBibleVersion('LSG', lsg)

    expect(sqlOf(mockTransaction.execAsync)).toContain(
      "INSERT INTO verses_fts(verses_fts) VALUES('rebuild')"
    )
    const statements = sqlOf(mockTransaction.runAsync)
    expect(statements[0]).toMatch(/SELECT 'delete'/)
    expect(statements[1]).toMatch(/SELECT 'delete'/)
    expect(mockWarn).toHaveBeenCalledWith(
      'database',
      'bibles.search_index_rebuilt',
      expect.objectContaining({ version: 'LSG' })
    )
  })

  it('does not rebuild the index for another failure', async () => {
    mockTransaction.runAsync.mockRejectedValueOnce(new Error('no such table: verses_fts'))

    await expect(insertBibleVersion('LSG', lsg)).rejects.toThrow('no such table')
    expect(sqlOf(mockTransaction.execAsync)).not.toContain(
      "INSERT INTO verses_fts(verses_fts) VALUES('rebuild')"
    )
  })

  it('queues a removal behind an install still running', async () => {
    let finishInstall!: () => void
    mockDatabase.withExclusiveTransactionAsync.mockImplementationOnce(async task => {
      await task(mockTransaction)
      await new Promise<void>(resolve => {
        finishInstall = resolve
      })
    })

    const install = insertBibleVersion('LSG', lsg)
    const removal = removeBibleVersion('KJV')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(mockDatabase.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1)

    finishInstall()
    await Promise.all([install, removal])
    expect(mockDatabase.withExclusiveTransactionAsync).toHaveBeenCalledTimes(2)
  })

  it('reopens the connection once when Android no longer finds the native object', async () => {
    mockDatabase.getAllAsync.mockRejectedValueOnce(
      new Error(
        "Call to function 'NativeDatabase.prepareAsync' has been rejected.\n→ Caused by: Cannot convert provided JavaScriptObject to the SharedObject, because it doesn't contain valid id"
      )
    )

    await expect(getInstalledVersions()).resolves.toEqual([])
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1)
  })
})
