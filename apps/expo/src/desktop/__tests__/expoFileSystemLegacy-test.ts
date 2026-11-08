const mockCall = jest.fn()

type MockChannel = { onmessage?: (message: unknown) => void }

jest.mock('../bridge', () => ({
  Channel: class {
    onmessage?: (message: unknown) => void
  },
  desktopBootstrap: () => ({
    documentDirectory: 'file:///data/',
    cacheDirectory: 'file:///cache/',
  }),
}))
jest.mock('../call', () => ({
  call: (...args: unknown[]) => mockCall(...args),
  toFileUri: (value: string) => (value.startsWith('file:') ? value : `file://${value}`),
}))

import * as FileSystem from '../shims/expoFileSystemLegacy'

describe('desktop expo-file-system', () => {
  beforeEach(() => mockCall.mockReset())

  it('exposes the shell directories as Expo constants', () => {
    expect(FileSystem.documentDirectory).toBe('file:///data/')
    expect(FileSystem.cacheDirectory).toBe('file:///cache/')
  })

  it('reports a missing file without throwing', async () => {
    mockCall.mockResolvedValue({ exists: false, isDirectory: false, uri: 'file:///data/a' })
    await expect(FileSystem.getInfoAsync('file:///data/a')).resolves.toEqual({
      exists: false,
      isDirectory: false,
      uri: 'file:///data/a',
    })
  })

  it('reads text and base64 from raw bytes', async () => {
    mockCall.mockResolvedValue(new TextEncoder().encode('Jean 3:16 é').buffer)
    await expect(FileSystem.readAsStringAsync('file:///data/a.json')).resolves.toBe('Jean 3:16 é')
    mockCall.mockResolvedValue(new Uint8Array([80, 75, 3, 4]).buffer)
    await expect(
      FileSystem.readAsStringAsync('file:///data/a.zip', { encoding: 'base64' })
    ).resolves.toBe('UEsDBA==')
  })

  it('deletes strictly unless asked to be idempotent', async () => {
    mockCall.mockResolvedValue(undefined)
    await FileSystem.deleteAsync('file:///data/a')
    await FileSystem.deleteAsync('/data/b', { idempotent: true })
    expect(mockCall.mock.calls).toEqual([
      ['fs_delete', { uri: 'file:///data/a', idempotent: false }],
      ['fs_delete', { uri: 'file:///data/b', idempotent: true }],
    ])
  })

  it('downloads with progress and resolves a non-2xx status instead of throwing', async () => {
    const progress = jest.fn()
    mockCall.mockImplementation(async (command: string, args: { onProgress: MockChannel }) => {
      args.onProgress.onmessage?.({ totalBytesWritten: 10, totalBytesExpectedToWrite: 20 })
      return { uri: 'file:///cache/a.zip', status: 404, headers: { etag: 'x' }, mimeType: null }
    })
    const download = FileSystem.createDownloadResumable(
      'https://api.bible-strong.app/a.zip',
      'file:///cache/a.zip',
      { headers: { Accept: '*/*' } },
      progress
    )
    await expect(download.downloadAsync()).resolves.toEqual({
      uri: 'file:///cache/a.zip',
      status: 404,
      headers: { etag: 'x' },
      mimeType: null,
    })
    expect(progress).toHaveBeenCalledWith({ totalBytesWritten: 10, totalBytesExpectedToWrite: 20 })
    expect(mockCall.mock.calls[0][1]).toMatchObject({
      url: 'https://api.bible-strong.app/a.zip',
      uri: 'file:///cache/a.zip',
      headers: { Accept: '*/*' },
    })
  })

  it('resolves a cancelled download to nothing, as a paused Expo download does', async () => {
    mockCall.mockResolvedValue(null)
    const download = FileSystem.createDownloadResumable('https://x/a.zip', 'file:///cache/a.zip')
    await download.pauseAsync()
    await expect(download.downloadAsync()).resolves.toBeUndefined()
    expect(mockCall.mock.calls[0][0]).toBe('download_cancel')
  })
})
