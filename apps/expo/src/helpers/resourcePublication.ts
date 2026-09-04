import { storage } from './storage'
import { MOBILE_RESOURCE_CATALOG, type MobileResourceCatalog } from './mobileResourceCatalog'

export interface ResourcePublication {
  revision: string
  size: number
  etag?: string
}

export interface InstalledResourcePublication extends ResourcePublication {
  sourceUrl: string
  installedAt: number
  archiveSha256?: string
}

export type ResourcePublicationStatus = 'current' | 'update-available'

export interface ResourcePublicationStorage {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  remove(key: string): void
}

const STORAGE_PREFIX = 'resource-publication:'

export const publicationFromArtifactResponse = (
  headers: { get(name: string): string | null },
  archiveSha256: string
): ResourcePublication => {
  if (!/^[a-f0-9]{64}$/.test(archiveSha256)) {
    throw new Error('RESOURCE_ARCHIVE_SHA256_INVALID')
  }
  const size = Number(headers.get('content-length') ?? 0)
  return {
    revision: archiveSha256,
    size: Number.isFinite(size) ? size : 0,
    etag: headers.get('etag') ?? undefined,
  }
}

type ResourcePublicationReaderWriter = Pick<
  ReturnType<typeof createResourcePublicationStore>,
  'read' | 'write'
>

export const resolveResourceCatalogStatus = async (
  resourceId: string,
  {
    catalog = MOBILE_RESOURCE_CATALOG,
    store = resourcePublicationStore,
  }: {
    catalog?: MobileResourceCatalog
    store?: ResourcePublicationReaderWriter
  } = {}
): Promise<ResourcePublicationStatus | undefined> => {
  const catalogEntry = catalog.resources[resourceId]
  const installed = store.read(resourceId)
  if (!catalogEntry) return undefined
  if (!installed) return 'update-available'

  return installed.archiveSha256 === catalogEntry.archiveSha256 ? 'current' : 'update-available'
}

export const createResourcePublicationStore = (backend: ResourcePublicationStorage) => ({
  read(resourceId: string): InstalledResourcePublication | undefined {
    const value = backend.getString(`${STORAGE_PREFIX}${resourceId}`)
    if (!value) return undefined
    try {
      return JSON.parse(value) as InstalledResourcePublication
    } catch {
      return undefined
    }
  },
  write(resourceId: string, publication: InstalledResourcePublication) {
    backend.set(`${STORAGE_PREFIX}${resourceId}`, JSON.stringify(publication))
  },
  remove(resourceId: string) {
    backend.remove(`${STORAGE_PREFIX}${resourceId}`)
  },
})

export const resourcePublicationStore = createResourcePublicationStore(storage)
