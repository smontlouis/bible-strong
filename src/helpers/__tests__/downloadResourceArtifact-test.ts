/* eslint-disable import/first */

const mockDownloadAsync = jest.fn()
const mockCancelAsync = jest.fn(() => Promise.resolve())
const mockCreateDownloadResumable = jest.fn(
  (_url: unknown, _fileUri: unknown, _options: unknown, _callback: unknown) => ({
    downloadAsync: mockDownloadAsync,
    cancelAsync: mockCancelAsync,
  })
)
const mockGetResourceDownloadHeaders = jest.fn((_url: unknown) => Promise.resolve({}))

jest.mock('expo-file-system/legacy', () => ({
  createDownloadResumable: (url: unknown, fileUri: unknown, options: unknown, callback: unknown) =>
    mockCreateDownloadResumable(url, fileUri, options, callback),
}))

jest.mock('../resourceAppCheck', () => ({
  getResourceDownloadHeaders: (url: unknown) => mockGetResourceDownloadHeaders(url),
}))

jest.mock('../storage', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}))

import { downloadResourceArtifact } from '../downloadResourceArtifact'

describe('R2 resource artifact download', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetResourceDownloadHeaders.mockResolvedValue({ 'X-Firebase-AppCheck': 'token' })
  })

  it('accepts standard R2 headers and records the catalog SHA-256 revision', async () => {
    const archiveSha256 = 'a'.repeat(64)
    mockDownloadAsync.mockResolvedValue({
      uri: '/tmp/dictionary.zip',
      status: 200,
      headers: {
        'content-length': '420',
        etag: '"r2-etag"',
      },
      mimeType: 'application/zip',
    })

    await expect(
      downloadResourceArtifact({
        url: 'https://api.bible-strong.app/v1/offline-artifacts/databases/dictionnaire.sqlite.zip',
        archiveSha256,
        destinationPath: '/tmp/dictionary.zip',
      })
    ).resolves.toEqual({
      result: expect.objectContaining({ status: 200 }),
      sourceUrl:
        'https://api.bible-strong.app/v1/offline-artifacts/databases/dictionnaire.sqlite.zip',
      publication: {
        revision: archiveSha256,
        size: 420,
        etag: '"r2-etag"',
      },
    })
    expect(mockCreateDownloadResumable).toHaveBeenCalledWith(
      expect.stringContaining('/v1/offline-artifacts/'),
      '/tmp/dictionary.zip',
      { headers: { 'X-Firebase-AppCheck': 'token' } },
      undefined
    )
  })

  it('times out while App Check headers are blocked before the download starts', async () => {
    mockGetResourceDownloadHeaders.mockReturnValueOnce(new Promise(() => undefined))

    await expect(
      downloadResourceArtifact({
        url: 'https://api.bible-strong.app/v1/offline-artifacts/databases/nave.sqlite.zip',
        archiveSha256: 'a'.repeat(64),
        destinationPath: '/tmp/nave.zip',
        timeoutMs: 5,
      })
    ).rejects.toThrow('RESOURCE_DOWNLOAD_TIMEOUT')
    expect(mockCreateDownloadResumable).not.toHaveBeenCalled()
  })

  it('cancels a native download when its total deadline expires', async () => {
    mockDownloadAsync.mockReturnValueOnce(new Promise(() => undefined))

    await expect(
      downloadResourceArtifact({
        url: 'https://api.bible-strong.app/v1/offline-artifacts/databases/nave.sqlite.zip',
        archiveSha256: 'a'.repeat(64),
        destinationPath: '/tmp/nave.zip',
        timeoutMs: 5,
      })
    ).rejects.toThrow('RESOURCE_DOWNLOAD_TIMEOUT')
    expect(mockCancelAsync).toHaveBeenCalled()
  })
})
