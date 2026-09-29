const mockIsSupported = jest.fn((_keyVersion: number) => true)
const mockExtractEncrypted = jest.fn((_options: unknown) => Promise.resolve('/extract'))
const mockUnzip = jest.fn((_source: string, _target: string, _charset: string) =>
  Promise.resolve('/extract')
)
const encryptedSha256 = 'e'.repeat(64)
const plainSha256 = 'a'.repeat(64)

jest.mock('../../../modules/bible-strong-archive', () => ({
  isEncryptedArchiveSupported: (keyVersion: number) => mockIsSupported(keyVersion),
  extractEncryptedArchive: (options: unknown) => mockExtractEncrypted(options),
}))
jest.mock('react-native-zip-archive', () => ({
  unzip: (source: string, target: string, charset: string) => mockUnzip(source, target, charset),
}))
jest.mock('../mobileResourceCatalog', () => ({
  MOBILE_RESOURCE_CATALOG: {
    resources: {
      'bible:LSG': {
        id: 'bible:LSG',
        archiveSha256: 'a'.repeat(64),
        encryptedArchive: {
          url: `https://api.bible-strong.app/v1/offline-archives/bibles/bible-lsg.json.encrypted.zip?sha256=${'e'.repeat(64)}`,
          file: 'bibles/bible-lsg.json.encrypted.zip',
          sha256: 'e'.repeat(64),
          bytes: 10,
          keyVersion: 1,
        },
      },
      'bible:KJV': { id: 'bible:KJV', archiveSha256: 'b'.repeat(64) },
    },
  },
}))

import { resolveOfflineArchiveSource, unzipOfflineArchive } from '../offlineArchiveSource'

const plainUrl = 'https://api.bible-strong.app/v1/offline-artifacts/bibles/bible-lsg.json.zip'

describe('Offline-copy archive source', () => {
  beforeEach(() => {
    mockIsSupported.mockReset().mockReturnValue(true)
    mockExtractEncrypted.mockClear()
    mockUnzip.mockClear()
  })

  it('prefers the encrypted copy when this binary holds its key version', () => {
    expect(resolveOfflineArchiveSource(plainUrl, plainSha256)).toEqual({
      kind: 'encrypted',
      url: `https://api.bible-strong.app/v1/offline-archives/bibles/bible-lsg.json.encrypted.zip?sha256=${encryptedSha256}`,
      archiveSha256: encryptedSha256,
      plainArchiveSha256: plainSha256,
      resourceId: 'bible:LSG',
      keyVersion: 1,
    })
    expect(mockIsSupported).toHaveBeenCalledWith(1)
  })

  it('keeps the plain archive without a key, an encrypted copy or a catalog entry', () => {
    mockIsSupported.mockReturnValue(false)
    expect(resolveOfflineArchiveSource(plainUrl, plainSha256)).toEqual({
      kind: 'plain',
      url: plainUrl,
      archiveSha256: plainSha256,
    })
    mockIsSupported.mockReturnValue(true)
    expect(resolveOfflineArchiveSource('https://x.test/kjv.zip', 'b'.repeat(64)).kind).toBe('plain')
    expect(resolveOfflineArchiveSource('https://x.test/other.zip', 'c'.repeat(64)).kind).toBe(
      'plain'
    )
  })

  it('keeps the origin of the requested plain URL, for local development Workers', () => {
    const source = resolveOfflineArchiveSource(
      'http://127.0.0.1:8787/v1/offline-artifacts/bibles/bible-lsg.json.zip',
      plainSha256
    )
    expect(source.url).toBe(
      `http://127.0.0.1:8787/v1/offline-archives/bibles/bible-lsg.json.encrypted.zip?sha256=${encryptedSha256}`
    )
  })

  it('extracts plain archives with unzip and encrypted ones natively with the plain SHA', async () => {
    await unzipOfflineArchive('file:///cache/a.zip', 'file:///cache/out/', {
      kind: 'plain',
      url: plainUrl,
      archiveSha256: plainSha256,
    })
    expect(mockUnzip).toHaveBeenCalledWith('/cache/a.zip', '/cache/out/', 'UTF-8')

    await unzipOfflineArchive(
      'file:///cache/a.zip',
      'file:///cache/out/',
      resolveOfflineArchiveSource(plainUrl, plainSha256)
    )
    expect(mockExtractEncrypted).toHaveBeenCalledWith({
      sourcePath: '/cache/a.zip',
      destinationPath: '/cache/out/',
      resourceId: 'bible:LSG',
      archiveSha256: plainSha256,
      keyVersion: 1,
    })
  })
})
