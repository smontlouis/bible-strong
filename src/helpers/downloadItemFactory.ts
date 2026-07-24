import type { DownloadItem, DownloadItemType } from '~state/downloadQueue'
import type { DatabaseId, ResourceLanguage } from '~helpers/databaseTypes'
import { versions, isStrongVersion, type Version } from '~helpers/bibleVersions'
import { biblesRef, getDatabaseUrl } from '~helpers/firebase'
import { databases, getDbPath } from '~helpers/databases'
import { requireBiblePath } from '~helpers/requireBiblePath'
import {
  getStrongBiblePublication,
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import type { StrongBibleSidecarAvailability } from './strongBibleSidecar'
import {
  BHG_INTERLINEAR_PUBLICATION,
  isInterlinearCapableBibleVersion,
} from './interlinearBiblePublications'
import type { InterlinearSidecarAvailability } from './interlinearBibleSidecar'

const BIBLE_ESTIMATED_SIZE = 2_500_000

/**
 * Create a DownloadItem for a Bible version.
 */
export function createBibleDownloadItem(versionId: string): DownloadItem {
  const version = versions[versionId as keyof typeof versions] as Version | undefined
  if (!version) throw new Error(`Unknown Bible version: ${versionId}`)

  const isStrong = isStrongVersion(versionId)
  const publication = isStrongCapableBibleVersion(versionId)
    ? getStrongBiblePublication(versionId)
    : undefined
  const interlinearPublication = isInterlinearCapableBibleVersion(versionId)
    ? BHG_INTERLINEAR_PUBLICATION
    : undefined

  const type: DownloadItemType = isStrong ? 'bible-strong' : 'bible'
  const url = interlinearPublication
    ? interlinearPublication.canonical.url
    : publication
      ? publication.canonical.url
      : isStrong
        ? versionId === 'INT'
          ? getDatabaseUrl('INTERLINEAIRE', 'fr')
          : versionId === 'INT_EN'
            ? getDatabaseUrl('INTERLINEAIRE', 'en')
            : biblesRef[versionId]
        : biblesRef[versionId]

  const destinationPath = isStrong ? requireBiblePath(versionId) : undefined

  // Strong/Interlinear are ~20MB SQLite files, regular bibles are ~2.5MB JSON
  const estimatedSize =
    interlinearPublication?.canonical.archiveBytes ??
    publication?.canonical.archiveBytes ??
    (isStrong ? 20_000_000 : BIBLE_ESTIMATED_SIZE)

  return {
    id: `bible:${versionId}`,
    type,
    name: version.name,
    versionId,
    url,
    destinationPath,
    estimatedSize,
    hasRedWords: version.hasRedWords,
    hasPericope: version.hasPericope,
    ...(publication ? { canonicalArtifact: publication.canonical } : {}),
    ...(interlinearPublication ? { archiveArtifact: interlinearPublication.canonical } : {}),
    addedAt: Date.now(),
    retryCount: 0,
  }
}

export function createInterlinearSidecarDownloadItem(lang: ResourceLanguage): DownloadItem {
  const artifact = BHG_INTERLINEAR_PUBLICATION.indexes[lang]
  return {
    id: `bible-interlinear:BHG:${lang}`,
    type: 'bible-interlinear-sidecar',
    name: `BHG — Interlinéaire ${lang.toUpperCase()}`,
    versionId: 'BHG',
    lang,
    url: artifact.url,
    estimatedSize: artifact.archiveBytes,
    interlinearArtifact: artifact,
    interlinearDatasetId: BHG_INTERLINEAR_PUBLICATION.datasetId,
    addedAt: Date.now(),
    retryCount: 0,
  }
}

export const createInterlinearSidecarDownloadPlan = (
  lang: ResourceLanguage,
  availabilityStatus: InterlinearSidecarAvailability['status']
): DownloadItem[] => {
  const sidecar = createInterlinearSidecarDownloadItem(lang)
  if (availabilityStatus !== 'base-missing' && availabilityStatus !== 'base-incompatible') {
    return [sidecar]
  }
  const bible = createBibleDownloadItem('BHG')
  return [bible, { ...sidecar, dependsOnId: bible.id }]
}

export function createStrongSidecarDownloadItem(versionId: StrongBibleVersionId): DownloadItem {
  const version = versions[versionId]
  const publication = getStrongBiblePublication(versionId)
  return {
    id: `bible-strong:${versionId}`,
    type: 'bible-strong-sidecar',
    name: `${version.name} — Strong`,
    versionId,
    url: publication.strong.url,
    estimatedSize: publication.strong.archiveBytes,
    strongArtifact: publication.strong,
    strongDatasetId: publication.datasetId,
    addedAt: Date.now(),
    retryCount: 0,
  }
}

export const createStrongSidecarDownloadPlan = (
  versionId: StrongBibleVersionId,
  availabilityStatus: StrongBibleSidecarAvailability['status']
): DownloadItem[] => {
  const sidecar = createStrongSidecarDownloadItem(versionId)
  if (availabilityStatus !== 'base-missing' && availabilityStatus !== 'base-incompatible') {
    return [sidecar]
  }

  const bible = createBibleDownloadItem(versionId)
  return [bible, { ...sidecar, dependsOnId: bible.id }]
}

export const dedupeDownloadItems = (items: DownloadItem[]): DownloadItem[] => [
  ...new Map(items.map(item => [item.id, item])).values(),
]

/**
 * Create a DownloadItem for a resource database (Strong, Dictionnaire, Nave, etc.).
 */
export function createDatabaseDownloadItem(
  databaseId: DatabaseId,
  lang: ResourceLanguage
): DownloadItem {
  // Exclude internal-only databases
  if (databaseId === 'BIBLES') throw new Error('BIBLES database is managed internally')

  const allDbs = databases(lang)
  const db = allDbs[databaseId as keyof typeof allDbs]
  if (!db) throw new Error(`Unknown database: ${databaseId}`)

  const url = getDatabaseUrl(databaseId as Exclude<DatabaseId, 'BIBLES'>, lang)
  const destinationPath = getDbPath(databaseId, lang)

  return {
    id: `database:${databaseId}:${lang}`,
    type: 'database',
    name: db.name,
    databaseId,
    lang,
    url,
    destinationPath,
    estimatedSize: db.fileSize,
    addedAt: Date.now(),
    retryCount: 0,
  }
}

/**
 * Extract the versionId or databaseId+lang from a download item id string.
 */
export function parseDownloadItemId(itemId: string): {
  type: 'bible' | 'database'
  versionId?: string
  databaseId?: DatabaseId
  lang?: ResourceLanguage
} {
  if (itemId.startsWith('bible:')) {
    return { type: 'bible', versionId: itemId.replace('bible:', '') }
  }
  if (itemId.startsWith('database:')) {
    const parts = itemId.split(':')
    return {
      type: 'database',
      databaseId: parts[1] as DatabaseId,
      lang: parts[2] as ResourceLanguage,
    }
  }
  throw new Error(`Invalid download item id: ${itemId}`)
}
