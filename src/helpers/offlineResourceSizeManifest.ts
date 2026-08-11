import bundledManifestJson from '~assets/offline-resource-size-manifest.json'

export type OfflineResourceSizeStrategy = 'direct-file' | 'archive-extract' | 'sqlite-import'

export type OfflineResourceSizeConfidence = 'exact' | 'estimated'

export type OfflineResourceSizeEntry = {
  id: string
  url: string
  downloadBytes: number
  contentBytes: number
  installedBytes: number
  peakInstallationBytes: number
  strategy: OfflineResourceSizeStrategy
  confidence: OfflineResourceSizeConfidence
}

export type OfflineResourceSizeManifest = {
  schemaVersion: 1
  generatedAt: string
  resources: Record<string, OfflineResourceSizeEntry>
}

export const OFFLINE_RESOURCE_SIZE_MANIFEST_URL =
  'https://assets.bible-strong.app/manifests/offline-resource-sizes.v1.json'

const isPositiveByteCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isEntry = (value: unknown): value is OfflineResourceSizeEntry => {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<OfflineResourceSizeEntry>
  return (
    typeof entry.id === 'string' &&
    typeof entry.url === 'string' &&
    isPositiveByteCount(entry.downloadBytes) &&
    isPositiveByteCount(entry.contentBytes) &&
    isPositiveByteCount(entry.installedBytes) &&
    isPositiveByteCount(entry.peakInstallationBytes) &&
    ['direct-file', 'archive-extract', 'sqlite-import'].includes(entry.strategy ?? '') &&
    ['exact', 'estimated'].includes(entry.confidence ?? '')
  )
}

export const isOfflineResourceSizeManifest = (
  value: unknown
): value is OfflineResourceSizeManifest => {
  if (!value || typeof value !== 'object') return false
  const manifest = value as Partial<OfflineResourceSizeManifest>
  if (
    manifest.schemaVersion !== 1 ||
    typeof manifest.generatedAt !== 'string' ||
    !manifest.resources ||
    typeof manifest.resources !== 'object'
  ) {
    return false
  }
  return Object.entries(manifest.resources).every(
    ([resourceId, entry]) =>
      resourceId === (entry as OfflineResourceSizeEntry)?.id && isEntry(entry)
  )
}

if (!isOfflineResourceSizeManifest(bundledManifestJson)) {
  throw new Error('INVALID_BUNDLED_OFFLINE_RESOURCE_SIZE_MANIFEST')
}

export const bundledOfflineResourceSizeManifest: OfflineResourceSizeManifest = bundledManifestJson

let resolvedManifest: OfflineResourceSizeManifest | undefined
let manifestRequest: Promise<OfflineResourceSizeManifest> | undefined

export const loadOfflineResourceSizeManifest = (
  fetcher: typeof fetch = fetch
): Promise<OfflineResourceSizeManifest> => {
  if (resolvedManifest) return Promise.resolve(resolvedManifest)
  if (manifestRequest) return manifestRequest

  manifestRequest = fetcher(OFFLINE_RESOURCE_SIZE_MANIFEST_URL, {
    headers: { Accept: 'application/json' },
  })
    .then(async response => {
      if (!response.ok) throw new Error(`SIZE_MANIFEST_HTTP_${response.status}`)
      const manifest: unknown = await response.json()
      if (!isOfflineResourceSizeManifest(manifest)) {
        throw new Error('INVALID_REMOTE_OFFLINE_RESOURCE_SIZE_MANIFEST')
      }
      resolvedManifest = {
        ...manifest,
        resources: {
          ...bundledOfflineResourceSizeManifest.resources,
          ...manifest.resources,
        },
      }
      return resolvedManifest
    })
    .catch(() => {
      resolvedManifest = bundledOfflineResourceSizeManifest
      return bundledOfflineResourceSizeManifest
    })

  return manifestRequest
}

export const getOfflineResourceSizeEntry = (
  resourceId: string,
  fallbackBytes: number,
  manifest: OfflineResourceSizeManifest = bundledOfflineResourceSizeManifest
): OfflineResourceSizeEntry =>
  manifest.resources[resourceId] ?? {
    id: resourceId,
    url: '',
    downloadBytes: fallbackBytes,
    contentBytes: fallbackBytes,
    installedBytes: fallbackBytes,
    peakInstallationBytes: Math.ceil(fallbackBytes * 1.15),
    strategy: 'direct-file',
    confidence: 'estimated',
  }
