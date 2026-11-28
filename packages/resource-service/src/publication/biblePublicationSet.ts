import {
  isBiblePublicationBundleManifest,
  isInterlinearBiblePublicationBundleManifest,
  isStrongBiblePublicationBundleManifest,
  validatePublicationBundle,
} from './publicationBundle'
import { getPublicationIdentityProjection } from './publicationIdentity'

export type BiblePublicationSetEntry = {
  bundlePath: string
  catalogId: string
  resourceIdentity: string
  revision: string
  bibleTextSha256?: string
  probe?: { book: number; chapter: number }
  bibleDependency?: {
    resourceIdentity: string
    revision: string
    textSha256: string
  }
}

export type BiblePublicationOverlay = {
  bundlePaths: string[]
  changedBundlePaths: string[]
  previousBundlePaths: string[]
  changedCatalogIds: string[]
  bibleRevision: string
  bibleTextSha256: string
}

const uniqueByCatalogId = (entries: readonly BiblePublicationSetEntry[], source: string) => {
  const result = new Map<string, BiblePublicationSetEntry>()
  for (const entry of entries) {
    if (result.has(entry.catalogId)) {
      throw new Error(`BIBLE_PUBLICATION_DUPLICATE_RESOURCE:${source}:${entry.catalogId}`)
    }
    result.set(entry.catalogId, entry)
  }
  return result
}

export const resolveBiblePublicationOverlay = (
  baselineEntries: readonly BiblePublicationSetEntry[],
  candidateEntries: readonly BiblePublicationSetEntry[],
  versionId: string,
  expectedResourceCount = 105
): BiblePublicationOverlay => {
  const targetResourceIdentity = `bible-text:${versionId}`
  const targetCatalogId = `bible:${versionId}`
  const baseline = uniqueByCatalogId(baselineEntries, 'baseline')
  const candidates = uniqueByCatalogId(candidateEntries, 'candidate')
  if (baseline.size !== expectedResourceCount) {
    throw new Error(
      `BIBLE_PUBLICATION_BASELINE_COUNT_MISMATCH:${baseline.size}:${expectedResourceCount}`
    )
  }

  const bible = candidates.get(targetCatalogId)
  if (!bible?.bibleTextSha256) {
    throw new Error(`BIBLE_PUBLICATION_TARGET_CANDIDATE_MISSING:${targetCatalogId}`)
  }
  for (const candidate of candidates.values()) {
    if (
      candidate.catalogId !== targetCatalogId &&
      candidate.bibleDependency?.resourceIdentity !== targetResourceIdentity
    ) {
      throw new Error(`BIBLE_PUBLICATION_UNRELATED_CANDIDATE:${candidate.catalogId}`)
    }
  }

  const overlay = new Map(baseline)
  for (const candidate of candidates.values()) overlay.set(candidate.catalogId, candidate)
  if (overlay.size !== expectedResourceCount) {
    throw new Error(
      `BIBLE_PUBLICATION_OVERLAY_COUNT_MISMATCH:${overlay.size}:${expectedResourceCount}`
    )
  }

  for (const entry of overlay.values()) {
    if (entry.bibleDependency?.resourceIdentity !== targetResourceIdentity) continue
    if (
      entry.bibleDependency.revision !== bible.revision ||
      entry.bibleDependency.textSha256 !== bible.bibleTextSha256
    ) {
      throw new Error(`BIBLE_PUBLICATION_DEPENDENT_REBUILD_REQUIRED:${entry.catalogId}`)
    }
  }

  return {
    bundlePaths: [...overlay.values()]
      .sort((left, right) => left.catalogId.localeCompare(right.catalogId))
      .map(entry => entry.bundlePath),
    changedBundlePaths: [...candidates.values()]
      .sort((left, right) => left.catalogId.localeCompare(right.catalogId))
      .map(entry => entry.bundlePath),
    previousBundlePaths: [...candidates.keys()]
      .sort()
      .map(catalogId => baseline.get(catalogId)?.bundlePath)
      .filter((bundlePath): bundlePath is string => !!bundlePath),
    changedCatalogIds: [...candidates.keys()].sort(),
    bibleRevision: bible.revision,
    bibleTextSha256: bible.bibleTextSha256,
  }
}

/**
 * The first chapter a canonical Bible holds, read to probe the live API: a list of verses, or a
 * Schema V4 object of books, chapters and verses keyed by their numbers.
 */
export const firstCanonicalChapter = (
  canonical: object
): { book?: unknown; chapter?: unknown } | undefined => {
  if (!('verses' in canonical)) return undefined
  const verses = canonical.verses
  if (Array.isArray(verses)) return verses[0] as { book?: unknown; chapter?: unknown } | undefined
  if (!verses || typeof verses !== 'object') return undefined
  const byNumber = (keys: string[]) =>
    keys.filter(key => /^\d+$/u.test(key)).sort((left, right) => Number(left) - Number(right))
  const book = byNumber(Object.keys(verses))[0]
  const chapters = book ? (verses as Record<string, unknown>)[book] : undefined
  if (!book || !chapters || typeof chapters !== 'object') return undefined
  const chapter = byNumber(Object.keys(chapters))[0]
  return chapter ? { book: Number(book), chapter: Number(chapter) } : undefined
}

export const describeBiblePublicationBundle = async (
  bundlePath: string
): Promise<BiblePublicationSetEntry> => {
  const validated = await validatePublicationBundle(bundlePath)
  const { manifest, canonical } = validated
  const { mobileCatalogId: catalogId, resourceIdentity } =
    getPublicationIdentityProjection(manifest)
  const bibleDependency =
    isStrongBiblePublicationBundleManifest(manifest) ||
    isInterlinearBiblePublicationBundleManifest(manifest)
      ? manifest.dependencies.bible
      : undefined
  const firstVerse = firstCanonicalChapter(canonical)
  return {
    bundlePath,
    catalogId,
    resourceIdentity,
    revision: manifest.revision,
    ...(typeof firstVerse?.book === 'number' && typeof firstVerse.chapter === 'number'
      ? { probe: { book: firstVerse.book, chapter: firstVerse.chapter } }
      : {}),
    ...(isBiblePublicationBundleManifest(manifest) && 'textSha256' in canonical
      ? { bibleTextSha256: canonical.textSha256 }
      : {}),
    ...(bibleDependency ? { bibleDependency } : {}),
  }
}

export const buildBiblePublicationOverlay = async (
  baselineBundlePaths: readonly string[],
  candidateBundlePaths: readonly string[],
  versionId: string,
  expectedResourceCount = 105
) =>
  resolveBiblePublicationOverlay(
    await Promise.all(baselineBundlePaths.map(describeBiblePublicationBundle)),
    await Promise.all(candidateBundlePaths.map(describeBiblePublicationBundle)),
    versionId,
    expectedResourceCount
  )

/**
 * A Bible publication can only touch the Bible family: a Bible text and the Strong and
 * interlinear sidecars built for it. Every other catalog entry is carried over unchanged.
 */
const BIBLE_FAMILY_CATALOG_KINDS = new Set(['bible', 'bible-strong', 'bible-interlinear'])

export const isBibleFamilyCatalogId = (catalogId: string) =>
  BIBLE_FAMILY_CATALOG_KINDS.has(catalogId.split(':')[0] ?? '')

export type RawPublicationCatalog = {
  format?: unknown
  schemaVersion?: unknown
  generatedAt?: unknown
  resourceCount: number
  resources: Record<string, { archiveSha256?: unknown } & Record<string, unknown>>
}

/** The resource count a catalog declares, checked against the resources it lists. */
export const catalogResourceCount = (catalog: RawPublicationCatalog, source: string) => {
  const listed = Object.keys(catalog.resources ?? {}).length
  if (!Number.isSafeInteger(catalog.resourceCount) || catalog.resourceCount !== listed) {
    throw new Error(
      `BIBLE_PUBLICATION_CATALOG_COUNT_INVALID:${source}:${catalog.resourceCount}:${listed}`
    )
  }
  return listed
}

export type PublicationManifestCandidate = { bundlePath: string; manifest: unknown }

type RawManifest = {
  format?: unknown
  revision?: unknown
  canonical?: { sha256?: unknown }
  offlineArtifact?: { sha256?: unknown }
  provenance?: { generatedAt?: unknown }
}

/**
 * Finds the published bundle of every Bible-family catalog entry among local bundles, by the
 * archive checksum the catalog delivers. Copies of one publication (same revision and canonical
 * checksum) may sit in several release folders; the most recently generated one is kept. Two
 * different publications delivering the same archive, or an entry with no bundle, fail closed.
 */
export const selectBibleFamilyBaseline = (
  catalog: RawPublicationCatalog,
  candidates: readonly PublicationManifestCandidate[]
): Map<string, string> => {
  const familyIds = Object.keys(catalog.resources).filter(isBibleFamilyCatalogId).sort()
  const idsByArchive = new Map<string, string[]>()
  for (const catalogId of familyIds) {
    const archiveSha256 = catalog.resources[catalogId]!.archiveSha256
    if (typeof archiveSha256 !== 'string') {
      throw new Error(`BIBLE_PUBLICATION_CATALOG_ENTRY_INVALID:${catalogId}`)
    }
    idsByArchive.set(archiveSha256, [...(idsByArchive.get(archiveSha256) ?? []), catalogId])
  }
  const matches = new Map<
    string,
    Array<{ bundlePath: string; identity: string; generatedAt: string }>
  >()
  for (const { bundlePath, manifest } of candidates) {
    const raw = (manifest ?? {}) as RawManifest
    if (raw.format !== 'bible-strong-resource-publication') continue
    const archiveSha256 = raw.offlineArtifact?.sha256
    if (typeof archiveSha256 !== 'string') continue
    for (const catalogId of idsByArchive.get(archiveSha256) ?? []) {
      matches.set(catalogId, [
        ...(matches.get(catalogId) ?? []),
        {
          bundlePath,
          identity: `${String(raw.revision)}:${String(raw.canonical?.sha256)}`,
          generatedAt:
            typeof raw.provenance?.generatedAt === 'string' ? raw.provenance.generatedAt : '',
        },
      ])
    }
  }
  const missing = familyIds.filter(catalogId => !matches.has(catalogId))
  if (missing.length > 0) {
    throw new Error(`BIBLE_PUBLICATION_BASELINE_BUNDLE_MISSING:${missing.join(',')}`)
  }
  const selected = new Map<string, string>()
  const selectedPaths = new Set<string>()
  for (const catalogId of familyIds) {
    const found = matches.get(catalogId)!
    if (new Set(found.map(match => match.identity)).size !== 1) {
      throw new Error(`BIBLE_PUBLICATION_BASELINE_BUNDLE_AMBIGUOUS:${catalogId}`)
    }
    const [chosen] = [...found].sort(
      (left, right) =>
        right.generatedAt.localeCompare(left.generatedAt) ||
        left.bundlePath.localeCompare(right.bundlePath)
    )
    if (selectedPaths.has(chosen!.bundlePath)) {
      throw new Error(`BIBLE_PUBLICATION_BASELINE_BUNDLE_SHARED:${catalogId}`)
    }
    selectedPaths.add(chosen!.bundlePath)
    selected.set(catalogId, chosen!.bundlePath)
  }
  return selected
}

/**
 * A candidate catalog may differ from the committed one only in the entries the publication
 * changed: every other entry, and the order of entries, stays exactly as delivered.
 */
export const assertCandidateCatalogChangesOnly = (
  committed: RawPublicationCatalog,
  candidate: RawPublicationCatalog,
  changedCatalogIds: readonly string[]
) => {
  const count = catalogResourceCount(committed, 'committed')
  if (
    candidate.format !== committed.format ||
    candidate.schemaVersion !== committed.schemaVersion ||
    catalogResourceCount(candidate, 'candidate') !== count
  ) {
    throw new Error('BIBLE_PUBLICATION_CANDIDATE_CATALOG_SHAPE_MISMATCH')
  }
  if (
    typeof candidate.generatedAt !== 'string' ||
    typeof committed.generatedAt !== 'string' ||
    !(Date.parse(candidate.generatedAt) >= Date.parse(committed.generatedAt))
  ) {
    throw new Error('BIBLE_PUBLICATION_CANDIDATE_CATALOG_OLDER')
  }
  if (Object.keys(candidate.resources).join('\n') !== Object.keys(committed.resources).join('\n')) {
    throw new Error('BIBLE_PUBLICATION_CANDIDATE_CATALOG_IDS_MISMATCH')
  }
  const changed = new Set(changedCatalogIds)
  for (const catalogId of changed) {
    if (!committed.resources[catalogId]) {
      throw new Error(`BIBLE_PUBLICATION_CANDIDATE_CATALOG_CHANGED_UNKNOWN:${catalogId}`)
    }
  }
  for (const [catalogId, entry] of Object.entries(committed.resources)) {
    if (changed.has(catalogId)) continue
    if (JSON.stringify(candidate.resources[catalogId]) !== JSON.stringify(entry)) {
      throw new Error(`BIBLE_PUBLICATION_CANDIDATE_CATALOG_UNRELATED_CHANGE:${catalogId}`)
    }
  }
}
