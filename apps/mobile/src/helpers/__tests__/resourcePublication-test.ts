/* eslint-disable import/first */

jest.mock('../storage', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}))

import {
  createResourcePublicationStore,
  publicationFromArtifactResponse,
  resolveResourceCatalogStatus,
  type ResourcePublicationStorage,
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
  it('uses catalog SHA-256 as the provider-neutral artifact revision', () => {
    const archiveSha256 = 'a'.repeat(64)
    const headers = new Headers({
      'content-length': '420',
      etag: '"r2-etag"',
    })

    expect(publicationFromArtifactResponse(headers, archiveSha256)).toEqual({
      revision: archiveSha256,
      size: 420,
      etag: '"r2-etag"',
    })
    expect(() => publicationFromArtifactResponse(headers, 'not-a-sha256')).toThrow(
      'RESOURCE_ARCHIVE_SHA256_INVALID'
    )
  })

  it('persists publication metadata only under the complete resource id', () => {
    const backend = memoryStorage()
    const store = createResourcePublicationStore(backend)
    store.write('database:DICTIONNAIRE:fr', {
      revision: 'a'.repeat(64),
      size: 12,
      sourceUrl: 'https://api.bible-strong.app/v1/offline-artifacts/dictionary.zip',
      installedAt: 123,
      archiveSha256: 'a'.repeat(64),
    })

    expect(store.read('database:DICTIONNAIRE:fr')?.revision).toBe('a'.repeat(64))
    expect(store.read('database:DICTIONNAIRE:en')).toBeUndefined()
    store.remove('database:DICTIONNAIRE:fr')
    expect(store.read('database:DICTIONNAIRE:fr')).toBeUndefined()
  })

  it('compares installed resources exclusively with the catalog SHA-256', async () => {
    const backend = memoryStorage()
    const store = createResourcePublicationStore(backend)
    const resourceId = 'database:NAVE:fr'
    const catalogEntry = BUNDLED_MOBILE_RESOURCE_CATALOG.resources[resourceId]
    store.write(resourceId, {
      revision: catalogEntry.archiveSha256,
      size: catalogEntry.archiveBytes,
      sourceUrl: catalogEntry.url,
      installedAt: 123,
      archiveSha256: catalogEntry.archiveSha256,
    })

    await expect(
      resolveResourceCatalogStatus(resourceId, {
        catalog: BUNDLED_MOBILE_RESOURCE_CATALOG,
        store,
      })
    ).resolves.toBe('current')

    store.write(resourceId, {
      ...store.read(resourceId)!,
      archiveSha256: '0'.repeat(64),
    })
    await expect(
      resolveResourceCatalogStatus(resourceId, {
        catalog: BUNDLED_MOBILE_RESOURCE_CATALOG,
        store,
      })
    ).resolves.toBe('update-available')
  })

  it('requires resources installed before SHA-256 tracking to be refreshed', async () => {
    const backend = memoryStorage()
    const store = createResourcePublicationStore(backend)
    const resourceId = 'database:NAVE:fr'
    const catalogEntry = BUNDLED_MOBILE_RESOURCE_CATALOG.resources[resourceId]
    backend.set(
      `resource-publication:${resourceId}`,
      JSON.stringify({
        generation: 'obsolete-provider-generation',
        size: catalogEntry.archiveBytes,
        sourceUrl: 'obsolete-provider-url',
        installedAt: 123,
      })
    )

    await expect(
      resolveResourceCatalogStatus(resourceId, {
        catalog: BUNDLED_MOBILE_RESOURCE_CATALOG,
        store,
      })
    ).resolves.toBe('update-available')
  })
})
