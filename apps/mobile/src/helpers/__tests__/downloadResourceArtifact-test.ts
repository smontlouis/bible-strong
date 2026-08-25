/* eslint-disable import/first */

const mockDownloadAsync = jest.fn()
const mockCancelAsync = jest.fn(() => Promise.resolve())
const mockDeleteAsync = jest.fn((_uri: unknown, _options: unknown) => Promise.resolve())
const mockCaptureError = jest.fn()
const mockWarn = jest.fn()
const mockCreateDownloadResumable = jest.fn(
  (_url: unknown, _fileUri: unknown, _options: unknown, _callback: unknown) => ({
    downloadAsync: mockDownloadAsync,
    cancelAsync: mockCancelAsync,
  })
)
const mockGetResourceDownloadAppCheckToken = jest.fn((_url: unknown, _forceRefresh?: unknown) =>
  Promise.resolve('token')
)

jest.mock('expo-file-system/legacy', () => ({
  createDownloadResumable: (url: unknown, fileUri: unknown, options: unknown, callback: unknown) =>
    mockCreateDownloadResumable(url, fileUri, options, callback),
  deleteAsync: (uri: unknown, options: unknown) => mockDeleteAsync(uri, options),
}))

jest.mock('../agentObservability', () => ({
  appLogger: {
    captureError: (...args: unknown[]) => mockCaptureError(...args),
    warn: (...args: unknown[]) => mockWarn(...args),
  },
}))

jest.mock('../resourceAppCheck', () => ({
  getResourceDownloadAppCheckToken: (url: unknown, forceRefresh: unknown) =>
    mockGetResourceDownloadAppCheckToken(url, forceRefresh),
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
    mockDownloadAsync.mockReset()
    mockCancelAsync.mockClear()
    mockDeleteAsync.mockClear()
    mockCaptureError.mockClear()
    mockWarn.mockClear()
    mockCreateDownloadResumable.mockClear()
    mockGetResourceDownloadAppCheckToken.mockReset()
    mockGetResourceDownloadAppCheckToken.mockResolvedValue('token')
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

  it('refreshes App Check once when an artifact download is rejected', async () => {
    mockGetResourceDownloadAppCheckToken.mockImplementation(async (_url, forceRefresh) =>
      forceRefresh ? 'fresh-token' : 'cached-token'
    )
    mockDownloadAsync
      .mockResolvedValueOnce({
        uri: '/tmp/resource.zip',
        status: 401,
        headers: {
          'x-request-id': 'stale-token-request',
          'content-length': '0',
        },
        mimeType: null,
      })
      .mockResolvedValueOnce({
        uri: '/tmp/resource.zip',
        status: 200,
        headers: { 'content-length': '420' },
        mimeType: 'application/zip',
      })

    await expect(
      downloadResourceArtifact({
        url: 'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-lsg.json.zip',
        archiveSha256: 'a'.repeat(64),
        destinationPath: '/tmp/resource.zip',
      })
    ).resolves.toEqual(
      expect.objectContaining({ result: expect.objectContaining({ status: 200 }) })
    )
    expect(mockGetResourceDownloadAppCheckToken.mock.calls).toEqual([
      [expect.stringContaining('bible-lsg.json.zip'), false],
      [expect.stringContaining('bible-lsg.json.zip'), true],
    ])
    expect(mockCreateDownloadResumable).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      '/tmp/resource.zip',
      { headers: { 'X-Firebase-AppCheck': 'fresh-token' } },
      undefined
    )
    expect(mockDeleteAsync).toHaveBeenCalledWith('/tmp/resource.zip', { idempotent: true })
    expect(mockWarn).toHaveBeenCalledWith(
      'download',
      'resource_artifact.auth_retry',
      expect.objectContaining({
        requestId: 'stale-token-request',
        appCheckHeaderPresent: true,
        appCheckProofFormat: 'opaque',
        appCheckProofLength: 12,
      })
    )
    expect(mockCaptureError).not.toHaveBeenCalled()
  })

  it('rejects an artifact after the refreshed App Check token is also refused', async () => {
    mockDownloadAsync
      .mockResolvedValueOnce({
        uri: '/tmp/resource.zip',
        status: 401,
        headers: {
          'x-request-id': 'request-401-cached',
          'content-length': '0',
        },
        mimeType: null,
      })
      .mockResolvedValueOnce({
        uri: '/tmp/resource.zip',
        status: 401,
        headers: {
          'x-request-id': 'request-401-refreshed',
          'content-length': '0',
        },
        mimeType: null,
      })

    await expect(
      downloadResourceArtifact({
        url: 'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-lsg.json.zip',
        archiveSha256: 'a'.repeat(64),
        destinationPath: '/tmp/resource.zip',
      })
    ).rejects.toThrow('RESOURCE_DOWNLOAD_HTTP_401')
    expect(mockCaptureError).toHaveBeenCalledWith(
      'download',
      'resource_artifact.http_failed',
      expect.objectContaining({
        code: 'RESOURCE_DOWNLOAD_HTTP_401',
        requestId: 'request-401-refreshed',
      }),
      expect.objectContaining({
        httpStatus: 401,
        requestId: 'request-401-refreshed',
        contentLength: '0',
        appCheckRefreshAttempted: true,
        appCheckHeaderPresent: true,
        appCheckProofFormat: 'opaque',
      })
    )
    expect(mockDeleteAsync).toHaveBeenCalledTimes(2)
  })

  it('times out while App Check headers are blocked before the download starts', async () => {
    mockGetResourceDownloadAppCheckToken.mockReturnValueOnce(new Promise(() => undefined))

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
