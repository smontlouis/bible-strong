import type { DownloadItem } from '~state/downloadQueue'
import { isSharedDB, type DatabaseId, type ResourceLanguage } from '~helpers/databaseTypes'
import { versions, type Version } from '~helpers/bibleVersions'
import { databases, getDbPath } from '~helpers/databases'
import { getMobileResourceCatalogEntry } from '~helpers/mobileResourceCatalog'
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
import { createOfflineCopyId, type OfflineCopyIdentity } from './offlineCopyId'
import {
  createStrongLexiconModuleDownloadItem,
  createStrongLexiconModuleDownloadPlan,
} from './strongLexiconDownloadItems'
export {
  createStrongLexiconModuleDownloadItem,
  createStrongLexiconModuleDownloadPlan,
} from './strongLexiconDownloadItems'

/**
 * Create a DownloadItem for a Bible version.
 */
export function createBibleDownloadItem(versionId: string): DownloadItem {
  const version = versions[versionId as keyof typeof versions] as Version | undefined
  if (!version) throw new Error(`Unknown Bible version: ${versionId}`)

  const publication = isStrongCapableBibleVersion(versionId)
    ? getStrongBiblePublication(versionId)
    : undefined
  const interlinearPublication = isInterlinearCapableBibleVersion(versionId)
    ? BHG_INTERLINEAR_PUBLICATION
    : undefined
  const catalogArtifact = getMobileResourceCatalogEntry(
    createOfflineCopyId({ kind: 'bible', versionId })
  )

  const url = catalogArtifact.url
  const estimatedSize = catalogArtifact.archiveBytes

  const common = {
    id: createOfflineCopyId({ kind: 'bible', versionId }),
    name: version.name,
    versionId,
    url,
    archiveEntry: catalogArtifact.entry,
    archiveEntries: {
      canonical: catalogArtifact.entries.canonical?.entry ?? catalogArtifact.entry,
      ...(catalogArtifact.entries.pericope
        ? { pericope: catalogArtifact.entries.pericope.entry }
        : {}),
      ...(catalogArtifact.entries.redWords
        ? { redWords: catalogArtifact.entries.redWords.entry }
        : {}),
    },
    estimatedSize,
    expectedArchiveSha256: catalogArtifact.archiveSha256,
    addedAt: Date.now(),
    retryCount: 0,
  }

  return {
    ...common,
    type: 'bible',
    ...(publication ? { canonicalArtifact: publication.canonical } : {}),
    ...(interlinearPublication ? { archiveArtifact: interlinearPublication.canonical } : {}),
  }
}

export function createInterlinearSidecarDownloadItem(lang: ResourceLanguage): DownloadItem {
  const publicationArtifact = BHG_INTERLINEAR_PUBLICATION.indexes[lang]
  const catalogArtifact = getMobileResourceCatalogEntry(
    createOfflineCopyId({ kind: 'interlinear-index', versionId: 'BHG', language: lang })
  )
  const artifact = {
    ...publicationArtifact,
    url: catalogArtifact.url,
    entry: catalogArtifact.entry,
    archiveSha256: catalogArtifact.archiveSha256,
    archiveBytes: catalogArtifact.archiveBytes,
    contentSha256: catalogArtifact.contentSha256,
    contentBytes: catalogArtifact.contentBytes,
  }
  return {
    id: createOfflineCopyId({
      kind: 'interlinear-index',
      versionId: 'BHG',
      language: lang,
    }),
    type: 'bible-interlinear-sidecar',
    name: `BHG — Interlinéaire ${lang.toUpperCase()}`,
    versionId: 'BHG',
    lang,
    url: artifact.url,
    estimatedSize: artifact.archiveBytes,
    expectedArchiveSha256: artifact.archiveSha256,
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
  const catalogArtifact = getMobileResourceCatalogEntry(
    createOfflineCopyId({ kind: 'strong-bible-index', versionId })
  )
  const strongArtifact = {
    ...publication.strong,
    url: catalogArtifact.url,
    entry: catalogArtifact.entry,
    archiveSha256: catalogArtifact.archiveSha256,
    archiveBytes: catalogArtifact.archiveBytes,
    contentSha256: catalogArtifact.contentSha256,
    contentBytes: catalogArtifact.contentBytes,
  }
  return {
    id: createOfflineCopyId({ kind: 'strong-bible-index', versionId }),
    type: 'bible-strong-sidecar',
    name: `${version.name} — Strong`,
    versionId,
    url: strongArtifact.url,
    estimatedSize: strongArtifact.archiveBytes,
    expectedArchiveSha256: strongArtifact.archiveSha256,
    strongArtifact,
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

type OfflineCopyDownloadPlanContext = {
  availabilityStatus?:
    | StrongBibleSidecarAvailability['status']
    | InterlinearSidecarAvailability['status']
  isStrongLexiconCoreAvailable?: boolean
}

export const createOfflineCopyDownloadItem = (identity: OfflineCopyIdentity): DownloadItem => {
  switch (identity.kind) {
    case 'bible':
      return createBibleDownloadItem(identity.versionId)
    case 'strong-bible-index':
      return createStrongSidecarDownloadItem(identity.versionId)
    case 'interlinear-index':
      return createInterlinearSidecarDownloadItem(identity.language)
    case 'strong-lexicon-module':
      return createStrongLexiconModuleDownloadItem(identity.moduleId)
    case 'database':
      return createDatabaseDownloadItem(identity.databaseId, identity.language)
    case 'bible-pericope':
    case 'bible-red-words':
      throw new Error(`BIBLE_CHILD_RESOURCE_REQUIRES_PARENT:${createOfflineCopyId(identity)}`)
  }
}

export const createOfflineCopyDownloadPlan = (
  identity: OfflineCopyIdentity,
  context: OfflineCopyDownloadPlanContext = {}
): DownloadItem[] => {
  switch (identity.kind) {
    case 'bible':
      return [createBibleDownloadItem(identity.versionId)]
    case 'strong-bible-index':
      return createStrongSidecarDownloadPlan(
        identity.versionId,
        (context.availabilityStatus as StrongBibleSidecarAvailability['status'] | undefined) ??
          'base-missing'
      )
    case 'interlinear-index':
      return createInterlinearSidecarDownloadPlan(
        identity.language,
        (context.availabilityStatus as InterlinearSidecarAvailability['status'] | undefined) ??
          'base-missing'
      )
    case 'strong-lexicon-module':
      return createStrongLexiconModuleDownloadPlan(
        identity.moduleId,
        context.isStrongLexiconCoreAvailable ?? false
      )
    case 'database':
      return [createDatabaseDownloadItem(identity.databaseId, identity.language)]
    case 'bible-pericope':
    case 'bible-red-words':
      throw new Error(`BIBLE_CHILD_RESOURCE_REQUIRES_PARENT:${createOfflineCopyId(identity)}`)
  }
}

/**
 * Create a DownloadItem for a resource database (Strong, Dictionnaire, Nave, etc.).
 */
export function createDatabaseDownloadItem(
  databaseId: Exclude<DatabaseId, 'BIBLES'>,
  lang: ResourceLanguage
): DownloadItem {
  const resourceLang = isSharedDB(databaseId) ? 'fr' : lang
  const allDbs = databases(resourceLang)
  const db = allDbs[databaseId as keyof typeof allDbs]
  if (!db) throw new Error(`Unknown database: ${databaseId}`)

  const catalogArtifact = getMobileResourceCatalogEntry(
    createOfflineCopyId({ kind: 'database', databaseId, language: resourceLang })
  )
  const url = catalogArtifact.url
  const destinationPath = getDbPath(databaseId, resourceLang)

  return {
    id: createOfflineCopyId({ kind: 'database', databaseId, language: resourceLang }),
    type: 'database',
    name: db.name,
    databaseId,
    lang: resourceLang,
    url,
    destinationPath,
    archiveEntry: catalogArtifact.entry,
    estimatedSize: catalogArtifact.archiveBytes,
    expectedArchiveSha256: catalogArtifact.archiveSha256,
    addedAt: Date.now(),
    retryCount: 0,
  }
}
