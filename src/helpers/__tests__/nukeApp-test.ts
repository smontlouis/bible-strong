/* eslint-disable import/first */

global.__DEV__ = true

jest.mock('@react-native-async-storage/async-storage', () => ({
  clear: jest.fn(),
}))
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  signOut: jest.fn(async () => {}),
}))
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  readDirectoryAsync: jest.fn(async () => []),
  deleteAsync: jest.fn(async () => {}),
}))
jest.mock('expo-updates', () => ({
  reloadAsync: jest.fn(),
}))
jest.mock('../biblesDb', () => ({
  closeBiblesDb: jest.fn(async () => {}),
}))
jest.mock('../storage', () => ({
  storage: { clearAll: jest.fn() },
}))
jest.mock('../../redux/store', () => ({
  persistor: { purge: jest.fn(async () => {}) },
}))

const mockAsyncStorageClear = jest.requireMock('@react-native-async-storage/async-storage')
  .clear as jest.Mock<Promise<void>, []>
const mockReloadAsync = jest.requireMock('expo-updates').reloadAsync as jest.Mock<Promise<void>, []>

import { nukeApp } from '../nukeApp'

describe('nukeApp', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAsyncStorageClear.mockResolvedValue()
    mockReloadAsync.mockResolvedValue()
  })

  it('waits for legacy AsyncStorage to be cleared before reloading', async () => {
    let finishClearing: (() => void) | undefined
    let confirmClearingStarted: (() => void) | undefined
    const clearingStarted = new Promise<void>(resolve => {
      confirmClearingStarted = resolve
    })
    mockAsyncStorageClear.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishClearing = resolve
          confirmClearingStarted?.()
        })
    )

    const nuke = nukeApp()
    await clearingStarted

    expect(mockAsyncStorageClear).toHaveBeenCalledTimes(1)
    expect(mockReloadAsync).not.toHaveBeenCalled()

    finishClearing?.()
    await nuke

    expect(mockReloadAsync).toHaveBeenCalledTimes(1)
  })

  it('continues the best-effort reset when clearing AsyncStorage fails', async () => {
    mockAsyncStorageClear.mockRejectedValueOnce(new Error('ASYNC_STORAGE_UNAVAILABLE'))

    await expect(nukeApp()).resolves.toBeUndefined()

    expect(mockReloadAsync).toHaveBeenCalledTimes(1)
  })
})
