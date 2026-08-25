import {
  BUNDLED_MOBILE_RESOURCE_CATALOG,
  loadMobileResourceCatalog,
  type MobileResourceCatalog,
} from './mobileResourceCatalog'

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

export const toOfflineResourceSizeManifest = (
  catalog: MobileResourceCatalog
): OfflineResourceSizeManifest => ({
  schemaVersion: 1,
  generatedAt: catalog.generatedAt,
  resources: Object.fromEntries(
    Object.entries(catalog.resources).map(([id, artifact]) => [
      id,
      {
        id,
        url: artifact.url,
        downloadBytes: artifact.archiveBytes,
        contentBytes: artifact.contentBytes,
        installedBytes: artifact.installedBytes,
        peakInstallationBytes: artifact.peakInstallationBytes,
        strategy: artifact.strategy,
        confidence: artifact.strategy === 'sqlite-import' ? 'estimated' : 'exact',
      },
    ])
  ),
})

export const bundledOfflineResourceSizeManifest = toOfflineResourceSizeManifest(
  BUNDLED_MOBILE_RESOURCE_CATALOG
)

export const loadOfflineResourceSizeManifest = (
  fetcher: typeof fetch = fetch
): Promise<OfflineResourceSizeManifest> =>
  loadMobileResourceCatalog(fetcher).then(toOfflineResourceSizeManifest)

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
