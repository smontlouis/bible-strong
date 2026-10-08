import { getMobileResourceCatalogEntry } from './mobileResourceCatalog'
import {
  ENGLISH_STRONG_BIBLE_PRIORITY,
  FRENCH_STRONG_BIBLE_PRIORITY,
  getStrongBibleCatalogIdentity,
  STRONG_BIBLE_FALLBACK_PRIORITY,
  type StrongBibleDatasetId,
  type StrongBibleVersionId,
} from './strongBibleCatalog'

export {
  ENGLISH_STRONG_BIBLE_PRIORITY,
  FRENCH_STRONG_BIBLE_PRIORITY,
  STRONG_BIBLE_FALLBACK_PRIORITY,
  type StrongBibleDatasetId,
  type StrongBibleVersionId,
} from './strongBibleCatalog'

export type StrongMode = 'visible' | 'hidden' | 'reverse-interlinear'

/**
 * Oldest publication schemas this reader understands. They are reader contracts, not
 * publication pins: newer schemas stay additive (ADR-0034). Which revision is published, its
 * archives and the text an index was built for are read from the catalog and from the files
 * themselves, never compiled into the application (ADR-0079).
 */
export const STRONG_BIBLE_INDEX_MIN_SCHEMA_VERSION = 4
export const REVERSE_INTERLINEAR_MIN_SCHEMA_VERSION = 2

export type StrongBiblePublicationArtifact = {
  url: string
  entry: string
  archiveSha256: string
  archiveBytes: number
  contentSha256: string
  contentBytes: number
}

export type StrongBibleIdentity = {
  applicationVersionId: StrongBibleVersionId
  datasetId: StrongBibleDatasetId
}

export type StrongBiblePublication = StrongBibleIdentity & {
  canonical: StrongBiblePublicationArtifact
  strong: StrongBiblePublicationArtifact
}

/** The Strong-capable Bibles and their datasets: identities, whatever revision is published. */
export const STRONG_BIBLE_PUBLICATIONS = Object.fromEntries(
  STRONG_BIBLE_FALLBACK_PRIORITY.map(versionId => [
    versionId,
    {
      applicationVersionId: versionId,
      datasetId: getStrongBibleCatalogIdentity(versionId).datasetId,
    },
  ])
) as Record<StrongBibleVersionId, StrongBibleIdentity>

const toArtifact = (resourceId: string): StrongBiblePublicationArtifact => {
  const entry = getMobileResourceCatalogEntry(resourceId)
  return {
    url: entry.url,
    entry: entry.entry,
    archiveSha256: entry.archiveSha256,
    archiveBytes: entry.archiveBytes,
    contentSha256: entry.contentSha256,
    contentBytes: entry.contentBytes,
  }
}

export const isStrongCapableBibleVersion = (versionId: string): versionId is StrongBibleVersionId =>
  versionId in STRONG_BIBLE_PUBLICATIONS

/** A Strong-capable Bible and its index as the catalog the application holds publishes them. */
export const getStrongBiblePublication = (
  versionId: StrongBibleVersionId
): StrongBiblePublication => ({
  ...STRONG_BIBLE_PUBLICATIONS[versionId],
  canonical: toArtifact(`bible:${versionId}`),
  strong: toArtifact(`bible-strong:${versionId}`),
})

/** Strong-capable Bibles are published as self-contained canonical Bibles (ADR-0066). */
export const usesCanonicalBibleExtras = (versionId: string): boolean =>
  isStrongCapableBibleVersion(versionId)

export const getStrongBibleAttributionKey = (
  versionId: StrongBibleVersionId
): 'versionSelector.strongAttribution' | 'versionSelector.strongAttributionEnglishSources' =>
  ENGLISH_STRONG_BIBLE_PRIORITY.includes(
    versionId as (typeof ENGLISH_STRONG_BIBLE_PRIORITY)[number]
  )
    ? 'versionSelector.strongAttributionEnglishSources'
    : 'versionSelector.strongAttribution'

const ENGLISH_BIBLE_VERSION_IDS = new Set([
  ...ENGLISH_STRONG_BIBLE_PRIORITY,
  'NKJV',
  'ESV',
  'NIV',
  'EASY',
  'TLV',
  'NET',
  'GW',
  'CSB',
  'NLT',
  'AMP',
])

export const getStrongBibleFallbackPriority = (
  bibleVersionId: string
): readonly StrongBibleVersionId[] =>
  ENGLISH_BIBLE_VERSION_IDS.has(bibleVersionId)
    ? ENGLISH_STRONG_BIBLE_PRIORITY
    : FRENCH_STRONG_BIBLE_PRIORITY

export const getStrongDatasetId = (versionId: string): StrongBibleDatasetId | undefined =>
  isStrongCapableBibleVersion(versionId)
    ? STRONG_BIBLE_PUBLICATIONS[versionId].datasetId
    : undefined

export const resolveStrongBibleVersion = (
  versionId: string,
  strongMode: StrongMode = 'hidden'
): { versionId: string; strongMode: StrongMode } => {
  return {
    versionId,
    strongMode: isStrongCapableBibleVersion(versionId) ? strongMode : 'hidden',
  }
}

export const resolveStrongNavigationVersionId = (
  versionId: string
): StrongBibleVersionId | undefined => {
  const resolvedVersionId = resolveStrongBibleVersion(versionId).versionId
  return isStrongCapableBibleVersion(resolvedVersionId) ? resolvedVersionId : undefined
}
