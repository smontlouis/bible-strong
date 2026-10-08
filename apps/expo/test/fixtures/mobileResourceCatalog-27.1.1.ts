/**
 * The catalog validator of Bible Strong 27.1.1 (commit f2f5f543e, the App Store release of
 * 2026-10-02), frozen. That release never receives another update: whatever the Resource
 * service serves must stay readable by this code. The body below is copied verbatim from
 * `apps/expo/src/helpers/mobileResourceCatalog.ts` at that commit; only the types are inlined
 * and the catalog it bundled is reduced to what its acceptance rule reads.
 */

type MobileResourceInstallationStrategy = 'sqlite-import' | 'archive-extract'
type MobileResourceEntryRole = 'canonical' | 'pericope' | 'redWords'

type MobileResourceCatalogFileEntry = {
  entry: string
  sha256: string
  bytes: number
}

type MobileResourceCatalogEntry = {
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

type MobileResourceCatalog = {
  format: 'bible-strong-mobile-resource-catalog'
  schemaVersion: 1
  generatedAt: string
  resourceCount: number
  resources: Record<string, MobileResourceCatalogEntry>
}

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
  const artifactUrl = isHttpsUrl(entry.url) ? new URL(entry.url) : undefined
  const archiveEntries = Object.entries(entries)
  const isStrongLexicon = typeof entry.id === 'string' && entry.id.startsWith('strong-lexicon:')
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    artifactUrl?.pathname.endsWith('.zip') === true &&
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
    (artifactUrl.searchParams.get('sha256') === null ||
      artifactUrl.searchParams.get('sha256') === entry.archiveSha256) &&
    isPositiveByteCount(entry.archiveBytes) &&
    isSha256(entry.contentSha256) &&
    isPositiveByteCount(entry.contentBytes) &&
    (!isStrongLexicon ||
      (typeof entry.resourceRevision === 'string' &&
        entry.resourceRevision.length > 0 &&
        (entry.id === 'strong-lexicon:core' ||
          entry.id === 'strong-lexicon:simple-fr' ||
          entry.id === 'strong-lexicon:simple-en' ||
          (typeof entry.coreRevision === 'string' && entry.coreRevision.length > 0)))) &&
    isPositiveByteCount(entry.installedBytes) &&
    isPositiveByteCount(entry.peakInstallationBytes) &&
    (entry.strategy === 'sqlite-import' || entry.strategy === 'archive-extract')
  )
}

export const isMobileResourceCatalogIn2711 = (value: unknown): value is MobileResourceCatalog => {
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

/** `generatedAt` and resource ids of the catalog bundled with 27.1.1. */
export const BUNDLED_CATALOG_GENERATED_AT_IN_2711 = '2026-09-28T18:43:25.170997+00:00'
export const BUNDLED_CATALOG_RESOURCE_IDS_IN_2711: readonly string[] = [
  'bible-interlinear:BHG:en',
  'bible-interlinear:BHG:fr',
  'bible-strong:ASV',
  'bible-strong:BSB',
  'bible-strong:DARBY',
  'bible-strong:DBR',
  'bible-strong:DBY',
  'bible-strong:KJV',
  'bible-strong:LSG',
  'bible-strong:NASB1995',
  'bible-strong:NASB2020',
  'bible-strong:RLT',
  'bible-strong:RV1895',
  'bible-strong:RWEBSTER',
  'bible:AMP',
  'bible:ASV',
  'bible:BCC1923',
  'bible:BDS',
  'bible:BFC',
  'bible:BHG',
  'bible:BHS',
  'bible:BSB',
  'bible:CHU',
  'bible:CSB',
  'bible:DARBY',
  'bible:DBR',
  'bible:DBY',
  'bible:DEL',
  'bible:EASY',
  'bible:ESV',
  'bible:FMAR',
  'bible:FRC97',
  'bible:GW',
  'bible:KJF',
  'bible:KJV',
  'bible:LAU',
  'bible:LSG',
  'bible:LXX',
  'bible:LXX_FR',
  'bible:NASB1995',
  'bible:NASB2020',
  'bible:NBS',
  'bible:NEG79',
  'bible:NET',
  'bible:NFC',
  'bible:NIV',
  'bible:NKJV',
  'bible:NLT',
  'bible:NVS78P',
  'bible:OST',
  'bible:PDV2017',
  'bible:POV',
  'bible:RLT',
  'bible:RV1895',
  'bible:RWEBSTER',
  'bible:S21',
  'bible:SBLGNT',
  'bible:TLV',
  'bible:TR1624',
  'bible:TR1894',
  'bible:VUL',
  'database:abbott:en',
  'database:acbc:en',
  'database:acbc:fr',
  'database:aquifer-fr:en',
  'database:aquifer-fr:fr',
  'database:barnes:en',
  'database:barnes:fr',
  'database:bible-annotee:fr',
  'database:BOST:fr',
  'database:burkitt:en',
  'database:CALMET:fr',
  'database:calvin:en',
  'database:catena-aurea:en',
  'database:darby-notes:en',
  'database:DICTIONNAIRE:en',
  'database:DICTIONNAIRE:fr',
  'database:douay-rheims-notes:en',
  'database:EASTON_WEBSTER:en',
  'database:egw-writings:en',
  'database:family-notes:en',
  'database:fourfold-gospel:en',
  'database:fre-aug:fr',
  'database:fre-chry:fr',
  'database:geneva-notes:en',
  'database:ISBE:en',
  'database:jfb:en',
  'database:kd:en',
  'database:king-comments:en',
  'database:LELIEVRE:fr',
  'database:lightfoot:en',
  'database:luther:en',
  'database:mhc:en',
  'database:mhcc:en',
  'database:mhm:en',
  'database:MHY:fr',
  'database:NAVE:en',
  'database:NAVE:fr',
  'database:pnt:en',
  'database:rashi-en:en',
  'database:rwp:en',
  'database:scofield:en',
  'database:sdabc:en',
  'database:sdabc:fr',
  'database:SMITH:en',
  'database:TIMELINE:en',
  'database:TIMELINE:fr',
  'database:treasury-david:en',
  'database:TRESOR:fr',
  'database:UNFOLDINGWORD_TW:en',
  'database:wesley:en',
  'database:WESTPHAL:fr',
  'dictionary-directory',
  'strong-lexicon:core',
  'strong-lexicon:entities',
  'strong-lexicon:resources',
  'strong-lexicon:simple-fr',
  'strong-lexicon:simple-en',
]

/** `resolveMobileResourceCatalog` of 27.1.1: true when the served catalog replaces the bundled one. */
export const acceptsServedCatalogIn2711 = (value: unknown): boolean => {
  if (
    !isMobileResourceCatalogIn2711(value) ||
    !BUNDLED_CATALOG_RESOURCE_IDS_IN_2711.every(id => id in value.resources)
  ) {
    return false
  }
  const bundledTimestamp = Date.parse(BUNDLED_CATALOG_GENERATED_AT_IN_2711)
  const candidateTimestamp = Date.parse(value.generatedAt)
  return Number.isFinite(candidateTimestamp) && candidateTimestamp >= bundledTimestamp
}

/** Publication constants 27.1.1 compiled in for BHG and its two interlinear indexes. */
export const BHG_TEXT_REVISION_IN_2711 = 'bhg-803c482ed06005693547'
export const BHG_ARCHIVE_ENTRY_IN_2711 = 'bible-step.json'
