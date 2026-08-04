jest.mock('../storage', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}))

import {
  compareResourcePublications,
  base64ChecksumToHex,
  assertResourceChecksum,
  fetchResourcePublication,
  type ResourcePublicationStorage,
  createResourcePublicationStore,
} from '../resourcePublication'

const memoryStorage = (): ResourcePublicationStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>()
  return {
    values,
    getString: key => values.get(key),
    set: (key, value) => values.set(key, value),
    remove: key => values.delete(key),
  }
}

describe('resource publications', () => {
  it('uses the Cloud Storage generation as the remote identity', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          ({
            'x-goog-generation': '1785141918946096',
            'x-goog-hash': 'crc32c=AAAAAA==,md5=YWJjZA==',
            'content-length': '420',
            etag: '"etag-value"',
          })[name.toLowerCase()] ?? null,
      },
    })

    await expect(fetchResourcePublication('https://cdn.test/db.zip', { fetcher })).resolves.toEqual(
      {
        generation: '1785141918946096',
        md5Hash: 'YWJjZA==',
        crc32c: 'AAAAAA==',
        size: 420,
        etag: '"etag-value"',
      }
    )
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('resource_metadata='),
      expect.objectContaining({ method: 'HEAD' })
    )
  })

  it('only reports an update when the stored generation differs', () => {
    expect(compareResourcePublications(undefined, { generation: '2', size: 1 })).toBe(
      'update-available'
    )
    expect(
      compareResourcePublications(
        { generation: '2', size: 1, installedAt: 1, sourceUrl: 'url' },
        { generation: '2', size: 99 }
      )
    ).toBe('current')
    expect(
      compareResourcePublications(
        { generation: '1', size: 1, installedAt: 1, sourceUrl: 'url' },
        { generation: '2', size: 1 }
      )
    ).toBe('update-available')
  })

  it('normalizes the Storage MD5 checksum for Expo downloads', () => {
    expect(base64ChecksumToHex('YWJjZA==')).toBe('61626364')
  })

  it('refuses absent or mismatched download checksums', () => {
    const publication = { generation: '1', size: 4, md5Hash: 'YWJjZA==' }
    expect(() => assertResourceChecksum(publication)).toThrow('RESOURCE_DOWNLOAD_CHECKSUM_MISSING')
    expect(() => assertResourceChecksum({ generation: '1', size: 4 }, '61626364')).toThrow(
      'RESOURCE_DOWNLOAD_CHECKSUM_MISSING'
    )
    expect(() => assertResourceChecksum(publication, '00000000')).toThrow(
      'RESOURCE_DOWNLOAD_CHECKSUM_MISMATCH'
    )
    expect(() => assertResourceChecksum(publication, '61626364')).not.toThrow()
  })

  it('persists publication metadata only under the complete resource id', () => {
    const backend = memoryStorage()
    const store = createResourcePublicationStore(backend)
    store.write('database:STRONG:fr', {
      generation: '7',
      size: 12,
      sourceUrl: 'https://cdn.test/strong.sqlite',
      installedAt: 123,
    })

    expect(store.read('database:STRONG:fr')?.generation).toBe('7')
    expect(store.read('database:STRONG:en')).toBeUndefined()
    store.remove('database:STRONG:fr')
    expect(store.read('database:STRONG:fr')).toBeUndefined()
  })
})
