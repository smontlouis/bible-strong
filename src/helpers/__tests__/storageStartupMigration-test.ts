/* eslint-disable import/first */

jest.mock('react-native-mmkv', () => {
  const values = new Map<string, string | boolean>()
  const backend = {
    getBoolean: jest.fn((key: string) => {
      const value = values.get(key)
      return typeof value === 'boolean' ? value : undefined
    }),
    getString: jest.fn((key: string) => {
      const value = values.get(key)
      return typeof value === 'string' ? value : undefined
    }),
    set: jest.fn((key: string, value: string | boolean) => values.set(key, value)),
    remove: jest.fn((key: string) => values.delete(key)),
  }
  return { createMMKV: () => backend }
})
jest.mock('react-native', () => ({
  InteractionManager: { runAfterInteractions: jest.fn() },
}))
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}))
jest.mock('../agentObservability', () => ({
  appLogger: { warn: jest.fn() },
}))

import { prepareLegacyStorageForLocalMigrations } from '../storage'

describe('prepareLegacyStorageForLocalMigrations', () => {
  it('finishes historical key-value and database moves once, in order', async () => {
    const flags = new Map<string, boolean>()
    const backend = {
      getBoolean: (key: string) => flags.get(key),
      set: (key: string, value: boolean) => flags.set(key, value),
    }
    const migrateAsyncStorage = jest.fn(async () => {
      flags.set('hasMigratedFromAsyncStorage', true)
    })
    const migrateFileSystemStorage = jest.fn(async () => {
      flags.set('hasMigratedFromFileSystem', true)
    })
    const migrateLanguageFolders = jest.fn(async () => {})

    const prepare = () =>
      prepareLegacyStorageForLocalMigrations({
        backend,
        migrateAsyncStorage,
        migrateFileSystemStorage,
        migrateLanguageFolders,
      })

    await prepare()

    expect(flags.get('hasMigratedFromAsyncStorage')).toBe(true)
    expect(flags.get('hasMigratedFromFileSystem')).toBe(true)
    expect(flags.get('hasMigratedToLanguageFolders')).toBe(true)
    expect(migrateAsyncStorage.mock.invocationCallOrder[0]).toBeLessThan(
      migrateFileSystemStorage.mock.invocationCallOrder[0]
    )
    expect(migrateFileSystemStorage.mock.invocationCallOrder[0]).toBeLessThan(
      migrateLanguageFolders.mock.invocationCallOrder[0]
    )

    await prepare()

    expect(migrateAsyncStorage).toHaveBeenCalledTimes(1)
    expect(migrateFileSystemStorage).toHaveBeenCalledTimes(1)
    expect(migrateLanguageFolders).toHaveBeenCalledTimes(1)
  })

  it('fails closed before later preparation when an old storage import fails', async () => {
    const backend = {
      getBoolean: () => undefined,
      set: jest.fn(),
    }
    const migrateAsyncStorage = jest.fn(async () => {
      throw new Error('ASYNC_STORAGE_UNAVAILABLE')
    })
    const migrateFileSystemStorage = jest.fn(async () => {})
    const migrateLanguageFolders = jest.fn(async () => {})

    await expect(
      prepareLegacyStorageForLocalMigrations({
        backend,
        migrateAsyncStorage,
        migrateFileSystemStorage,
        migrateLanguageFolders,
      })
    ).rejects.toThrow('ASYNC_STORAGE_UNAVAILABLE')
    expect(migrateFileSystemStorage).not.toHaveBeenCalled()
    expect(migrateLanguageFolders).not.toHaveBeenCalled()
  })
})
