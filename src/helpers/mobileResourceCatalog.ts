import catalogJson from '~assets/mobile-resource-catalog.json'

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

const catalog = catalogJson as MobileResourceCatalog

if (
  catalog.format !== 'bible-strong-mobile-resource-catalog' ||
  catalog.schemaVersion !== 1 ||
  catalog.resourceCount !== Object.keys(catalog.resources).length
) {
  throw new Error('MOBILE_RESOURCE_CATALOG_INVALID')
}

export const MOBILE_RESOURCE_CATALOG = catalog

export const getMobileResourceCatalogEntry = (resourceId: string): MobileResourceCatalogEntry => {
  const entry = catalog.resources[resourceId]
  if (!entry) throw new Error(`MOBILE_RESOURCE_CATALOG_ENTRY_MISSING:${resourceId}`)
  return entry
}
