/* eslint-disable import/first */

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
  resolveResourceCatalogStatus,
} from '../resourcePublication'
import { BUNDLED_MOBILE_RESOURCE_CATALOG } from '../mobileResourceCatalog'

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

  it('compares installed resources with the catalog SHA without fetching the artifact', async () => {
    const backend = memoryStorage()
    const store = createResourcePublicationStore(backend)
    const resourceId = 'database:NAVE:fr'
    const catalogEntry = BUNDLED_MOBILE_RESOURCE_CATALOG.resources[resourceId]
    const fetcher = jest.fn()
    store.write(resourceId, {
      generation: '7',
      size: catalogEntry.archiveBytes,
      sourceUrl: catalogEntry.url,
      installedAt: 123,
      archiveSha256: catalogEntry.archiveSha256,
    })

    await expect(
      resolveResourceCatalogStatus(resourceId, {
        catalog: BUNDLED_MOBILE_RESOURCE_CATALOG,
        store,
        fetcher,
      })
    ).resolves.toBe('current')
    expect(fetcher).not.toHaveBeenCalled()

    store.write(resourceId, {
      ...store.read(resourceId)!,
      archiveSha256: '0'.repeat(64),
    })
    await expect(
      resolveResourceCatalogStatus(resourceId, {
        catalog: BUNDLED_MOBILE_RESOURCE_CATALOG,
        store,
        fetcher,
      })
    ).resolves.toBe('update-available')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('performs one legacy HEAD then records the catalog SHA for future local checks', async () => {
    const backend = memoryStorage()
    const store = createResourcePublicationStore(backend)
    const resourceId = 'database:NAVE:fr'
    const catalogEntry = BUNDLED_MOBILE_RESOURCE_CATALOG.resources[resourceId]
    store.write(resourceId, {
      generation: 'legacy-generation',
      size: catalogEntry.archiveBytes,
      sourceUrl: catalogEntry.url,
      installedAt: 123,
    })
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          ({
            'x-goog-generation': 'legacy-generation',
            'content-length': String(catalogEntry.archiveBytes),
          })[name.toLowerCase()] ?? null,
      },
    })

    await expect(
      resolveResourceCatalogStatus(resourceId, {
        catalog: BUNDLED_MOBILE_RESOURCE_CATALOG,
        store,
        fetcher,
      })
    ).resolves.toBe('current')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(store.read(resourceId)?.archiveSha256).toBe(catalogEntry.archiveSha256)

    await resolveResourceCatalogStatus(resourceId, {
      catalog: BUNDLED_MOBILE_RESOURCE_CATALOG,
      store,
      fetcher,
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('remembers a legacy generation mismatch without repeating HEAD requests', async () => {
    const backend = memoryStorage()
    const store = createResourcePublicationStore(backend)
    const resourceId = 'database:NAVE:fr'
    const catalogEntry = BUNDLED_MOBILE_RESOURCE_CATALOG.resources[resourceId]
    store.write(resourceId, {
      generation: 'installed-generation',
      size: catalogEntry.archiveBytes,
      sourceUrl: catalogEntry.url,
      installedAt: 123,
    })
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          ({
            'x-goog-generation': 'new-generation',
            'content-length': String(catalogEntry.archiveBytes),
          })[name.toLowerCase()] ?? null,
      },
    })

    await expect(
      resolveResourceCatalogStatus(resourceId, {
        catalog: BUNDLED_MOBILE_RESOURCE_CATALOG,
        store,
        fetcher,
      })
    ).resolves.toBe('update-available')
    await expect(
      resolveResourceCatalogStatus(resourceId, {
        catalog: BUNDLED_MOBILE_RESOURCE_CATALOG,
        store,
        fetcher,
      })
    ).resolves.toBe('update-available')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(store.read(resourceId)?.legacyCatalogUpdateDetected).toBe(true)
  })
})
