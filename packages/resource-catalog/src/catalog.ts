import catalogJson from './mobile-resource-catalog.json'

export type MobileResourceInstallationStrategy = 'sqlite-import' | 'archive-extract'
export type MobileResourceEntryRole = 'canonical' | 'pericope' | 'redWords'

export type MobileResourceCatalogFileEntry = {
  entry: string
  sha256: string
  bytes: number
}

export type MobileResourceCatalogEntry = {
  id: string
  url: string
  file: string
  entry: string
  entries: Partial<Record<MobileResourceEntryRole, MobileResourceCatalogFileEntry>>
  archiveSha256: string
  archiveBytes: number
  contentSha256: string
  contentBytes: number
  resourceRevision?: string
  coreRevision?: string
  installedBytes: number
  peakInstallationBytes: number
  strategy: MobileResourceInstallationStrategy
}

export type MobileResourceCatalog = {
  format: 'bible-strong-mobile-resource-catalog'
  schemaVersion: 1
  generatedAt: string
  resourceCount: number
  resources: Record<string, MobileResourceCatalogEntry>
}

export const BUNDLED_MOBILE_RESOURCE_CATALOG = catalogJson as MobileResourceCatalog

export const getCatalogBibleVersionIds = (
  catalog: MobileResourceCatalog = BUNDLED_MOBILE_RESOURCE_CATALOG
): string[] =>
  Object.keys(catalog.resources)
    .filter(resourceId => resourceId.startsWith('bible:'))
    .map(resourceId => resourceId.slice('bible:'.length))
    .sort()

export const getCatalogStrongBibleVersionIds = (
  catalog: MobileResourceCatalog = BUNDLED_MOBILE_RESOURCE_CATALOG
): string[] =>
  Object.keys(catalog.resources)
    .filter(resourceId => resourceId.startsWith('bible-strong:'))
    .map(resourceId => resourceId.slice('bible-strong:'.length))
    .sort()

export const getMobileBibleVersionIds = getCatalogBibleVersionIds
export const getMobileStrongBibleVersionIds = getCatalogStrongBibleVersionIds

export default BUNDLED_MOBILE_RESOURCE_CATALOG
