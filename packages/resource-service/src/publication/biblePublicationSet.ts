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
  const firstVerse =
    'verses' in canonical && Array.isArray(canonical.verses)
      ? (canonical.verses[0] as { book?: unknown; chapter?: unknown } | undefined)
      : undefined
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
