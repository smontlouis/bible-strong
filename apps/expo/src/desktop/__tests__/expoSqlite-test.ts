const mockCall = jest.fn()

jest.mock('../bridge', () => ({
  desktopBootstrap: () => ({ documentDirectory: 'file:///data/' }),
}))
jest.mock('../call', () => ({
  call: (...args: unknown[]) => mockCall(...args),
  toFileUri: (value: string) => value,
}))

import { openDatabaseAsync } from '../shims/expoSqlite'

describe('desktop expo-sqlite', () => {
  beforeEach(() => {
    mockCall.mockReset()
    mockCall.mockImplementation(async (command: string) => (command === 'sqlite_open' ? 7 : []))
  })

  it('opens a file in the given directory, or in SQLite/ by default', async () => {
    await openDatabaseAsync('LSG.sqlite', { useNewConnection: true }, 'file:///data/SQLite/fr')
    await openDatabaseAsync('legacy.sqlite')
    expect(mockCall.mock.calls).toEqual([
      ['sqlite_open', { uri: 'file:///data/SQLite/fr/LSG.sqlite' }],
      ['sqlite_open', { uri: 'file:///data/SQLite/legacy.sqlite' }],
    ])
  })

  it('accepts parameters as an array or spread, as expo-sqlite does', async () => {
    const database = await openDatabaseAsync('a.sqlite')
    await database.getAllAsync('SELECT ?, ?', [1, 'a'])
    await database.getFirstAsync('SELECT ?, ?', 2, null)
    await database.runAsync('INSERT INTO t VALUES (?)', new Uint8Array([1, 2]))
    expect(mockCall.mock.calls.slice(1)).toEqual([
      ['sqlite_all', { id: 7, sql: 'SELECT ?, ?', params: [1, 'a'] }],
      ['sqlite_first', { id: 7, sql: 'SELECT ?, ?', params: [2, null] }],
      ['sqlite_run', { id: 7, sql: 'INSERT INTO t VALUES (?)', params: [[1, 2]] }],
    ])
  })

  it('reports a closed connection with the wording the app retries on', async () => {
    const database = await openDatabaseAsync('a.sqlite')
    await database.closeAsync()
    await expect(database.getAllAsync('SELECT 1')).rejects.toThrow('already released')
  })

  it('runs an exclusive transaction on its own connection and rolls back on failure', async () => {
    let next = 7
    mockCall.mockImplementation(async (command: string) =>
      command === 'sqlite_open' ? next++ : undefined
    )
    const database = await openDatabaseAsync('a.sqlite')
    await expect(
      database.withExclusiveTransactionAsync(async txn => {
        await txn.runAsync('INSERT INTO t VALUES (1)')
        throw new Error('cancelled')
      })
    ).rejects.toThrow('cancelled')
    const commands = mockCall.mock.calls.map(([command, args]) => [command, args.id, args.sql])
    expect(commands.slice(1)).toEqual([
      ['sqlite_open', undefined, undefined],
      ['sqlite_exec', 8, 'BEGIN'],
      ['sqlite_run', 8, 'INSERT INTO t VALUES (1)'],
      ['sqlite_exec', 8, 'ROLLBACK'],
      ['sqlite_close', 8, undefined],
    ])
  })
})
