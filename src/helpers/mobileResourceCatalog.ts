import catalogJson from '~assets/mobile-resource-catalog.json'
import { ORDINARY_BIBLE_VERSION_IDS } from './ordinaryBibleVersions'
import { atom, getDefaultStore } from 'jotai/vanilla'

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

export const MOBILE_RESOURCE_CATALOG_URL =
  'https://assets.bible-strong.app/manifests/mobile-resource-catalog.json'
const MOBILE_RESOURCE_CATALOG_TIMEOUT_MS = 3_000
const CATALOG_ENTRY_ROLES = new Set<MobileResourceEntryRole>(['canonical', 'pericope', 'redWords'])

const isPositiveByteCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isSha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

const isSafeRelativePath = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  !value.startsWith('/') &&
  !value.includes('\\') &&
  value.split('/').every(segment => segment.length > 0 && segment !== '.' && segment !== '..')

const isHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

const isCatalogFileEntry = (value: unknown): value is MobileResourceCatalogFileEntry => {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<MobileResourceCatalogFileEntry>
  return (
    isSafeRelativePath(entry.entry) && isSha256(entry.sha256) && isPositiveByteCount(entry.bytes)
  )
}

const isCatalogEntry = (value: unknown): value is MobileResourceCatalogEntry => {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<MobileResourceCatalogEntry>
  const entries = entry.entries
  if (!entries || typeof entries !== 'object') return false
  const archiveEntries = Object.entries(entries)
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    isHttpsUrl(entry.url) &&
    entry.url.endsWith('.zip') &&
    isSafeRelativePath(entry.file) &&
    entry.file.endsWith('.zip') &&
    isSafeRelativePath(entry.entry) &&
    isCatalogFileEntry(entries.canonical) &&
    entries.canonical.entry === entry.entry &&
    archiveEntries.every(
      ([role, fileEntry]) =>
        CATALOG_ENTRY_ROLES.has(role as MobileResourceEntryRole) && isCatalogFileEntry(fileEntry)
    ) &&
    isSha256(entry.archiveSha256) &&
    isPositiveByteCount(entry.archiveBytes) &&
    isSha256(entry.contentSha256) &&
    isPositiveByteCount(entry.contentBytes) &&
    isPositiveByteCount(entry.installedBytes) &&
    isPositiveByteCount(entry.peakInstallationBytes) &&
    (entry.strategy === 'sqlite-import' || entry.strategy === 'archive-extract')
  )
}

export const isMobileResourceCatalog = (value: unknown): value is MobileResourceCatalog => {
  if (!value || typeof value !== 'object') return false
  const catalog = value as Partial<MobileResourceCatalog>
  return (
    catalog.format === 'bible-strong-mobile-resource-catalog' &&
    catalog.schemaVersion === 1 &&
    typeof catalog.generatedAt === 'string' &&
    typeof catalog.resourceCount === 'number' &&
    !!catalog.resources &&
    typeof catalog.resources === 'object' &&
    catalog.resourceCount === Object.keys(catalog.resources).length &&
    Object.entries(catalog.resources).every(
      ([resourceId, entry]) =>
        resourceId === (entry as MobileResourceCatalogEntry)?.id && isCatalogEntry(entry)
    )
  )
}

if (!isMobileResourceCatalog(catalogJson)) throw new Error('MOBILE_RESOURCE_CATALOG_INVALID')

export const BUNDLED_MOBILE_RESOURCE_CATALOG: MobileResourceCatalog = catalogJson
export let MOBILE_RESOURCE_CATALOG: MobileResourceCatalog = BUNDLED_MOBILE_RESOURCE_CATALOG
export const mobileResourceCatalogAtom = atom<MobileResourceCatalog>(
  BUNDLED_MOBILE_RESOURCE_CATALOG
)

const hasBundledResourceIdentities = (catalog: MobileResourceCatalog): boolean => {
  const bundledIds = Object.keys(BUNDLED_MOBILE_RESOURCE_CATALOG.resources).sort()
  return bundledIds.every(id => id in catalog.resources)
}

export const resolveMobileResourceCatalog = (value: unknown): MobileResourceCatalog => {
  if (!isMobileResourceCatalog(value) || !hasBundledResourceIdentities(value)) {
    return BUNDLED_MOBILE_RESOURCE_CATALOG
  }
  const bundledTimestamp = Date.parse(BUNDLED_MOBILE_RESOURCE_CATALOG.generatedAt)
  const candidateTimestamp = Date.parse(value.generatedAt)
  return Number.isFinite(candidateTimestamp) && candidateTimestamp >= bundledTimestamp
    ? value
    : BUNDLED_MOBILE_RESOURCE_CATALOG
}

let catalogRequest: Promise<MobileResourceCatalog> | undefined
let catalogResolved = false
let resolvedFetcher: typeof fetch | undefined

export const loadMobileResourceCatalog = (
  fetcher: typeof fetch = fetch
): Promise<MobileResourceCatalog> => {
  if (catalogResolved && resolvedFetcher === fetcher) {
    return Promise.resolve(MOBILE_RESOURCE_CATALOG)
  }
  if (catalogRequest) return catalogRequest

  const abortController = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutRequest = new Promise<Response>((_, reject) => {
    timeout = setTimeout(() => {
      abortController.abort()
      reject(new Error('MOBILE_RESOURCE_CATALOG_TIMEOUT'))
    }, MOBILE_RESOURCE_CATALOG_TIMEOUT_MS)
  })
  catalogRequest = Promise.race([
    fetcher(MOBILE_RESOURCE_CATALOG_URL, {
      headers: { Accept: 'application/json' },
      signal: abortController.signal,
    }),
    timeoutRequest,
  ])
    .then(async response => {
      if (!response.ok) throw new Error(`MOBILE_RESOURCE_CATALOG_HTTP_${response.status}`)
      const remoteCatalog: unknown = await response.json()
      const resolvedCatalog = resolveMobileResourceCatalog(remoteCatalog)
      if (
        resolvedCatalog === BUNDLED_MOBILE_RESOURCE_CATALOG &&
        remoteCatalog !== BUNDLED_MOBILE_RESOURCE_CATALOG
      ) {
        throw new Error('MOBILE_RESOURCE_REMOTE_CATALOG_INVALID')
      }
      MOBILE_RESOURCE_CATALOG = resolvedCatalog
      getDefaultStore().set(mobileResourceCatalogAtom, resolvedCatalog)
      return MOBILE_RESOURCE_CATALOG
    })
    .catch(() => {
      MOBILE_RESOURCE_CATALOG = BUNDLED_MOBILE_RESOURCE_CATALOG
      getDefaultStore().set(mobileResourceCatalogAtom, BUNDLED_MOBILE_RESOURCE_CATALOG)
      return BUNDLED_MOBILE_RESOURCE_CATALOG
    })
    .finally(() => {
      if (timeout) clearTimeout(timeout)
      catalogResolved = true
      resolvedFetcher = fetcher
      catalogRequest = undefined
    })

  return catalogRequest
}

export const getMobileResourceCatalogEntry = (resourceId: string): MobileResourceCatalogEntry => {
  const entry = MOBILE_RESOURCE_CATALOG.resources[resourceId]
  if (!entry) throw new Error(`MOBILE_RESOURCE_CATALOG_ENTRY_MISSING:${resourceId}`)
  return {
    ...entry,
    url: resolveMobileResourceArtifactUrl(entry),
  }
}

export const getMobileBibleVersionIds = (
  catalog: MobileResourceCatalog = MOBILE_RESOURCE_CATALOG
): string[] =>
  catalog === BUNDLED_MOBILE_RESOURCE_CATALOG
    ? [...ORDINARY_BIBLE_VERSION_IDS]
    : Object.keys(catalog.resources)
        .filter(resourceId => resourceId.startsWith('bible:'))
        .map(resourceId => resourceId.slice('bible:'.length))
        .sort()

let developmentResourceArtifactBaseUrl: string | undefined

export const configureDevelopmentResourceArtifactBaseUrl = (value: string | undefined): void => {
  developmentResourceArtifactBaseUrl = __DEV__ ? value : undefined
}

export const resolveMobileResourceArtifactUrl = (
  entry: Pick<MobileResourceCatalogEntry, 'file' | 'url'>,
  configuredBaseUrl = developmentResourceArtifactBaseUrl
): string => {
  if (!configuredBaseUrl) return entry.url
  try {
    const baseUrl = new URL(configuredBaseUrl)
    if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') return entry.url
    if (!baseUrl.pathname.endsWith('/')) baseUrl.pathname += '/'
    return new URL(entry.file, baseUrl).toString()
  } catch {
    return entry.url
  }
}
