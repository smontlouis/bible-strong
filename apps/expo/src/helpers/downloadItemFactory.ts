import type { DownloadItem } from '~state/downloadQueue'
import { isSharedDB, type DatabaseId, type ResourceLanguage } from '~helpers/databaseTypes'
import { versions, type Version } from '~helpers/bibleVersions'
import {
  databases,
  getCommentaryDbPath,
  getDbPath,
  getDictionaryDbPath,
  getDictionaryDirectoryDbPath,
} from '~helpers/databases'
import { getMobileResourceCatalogEntry } from '~helpers/mobileResourceCatalog'
import {
  getStrongBiblePublication,
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import type { StrongBibleSidecarAvailability } from './strongBibleSidecar'
import {
  getInterlinearBiblePublication,
  isInterlinearCapableBibleVersion,
} from './interlinearBiblePublications'
import type { InterlinearSidecarAvailability } from './interlinearBibleSidecar'
import { resourcePublicationStore } from './resourcePublication'
import {
  createOfflineCopyId,
  getOfflineCopyCatalogId,
  type OfflineCopyIdentity,
} from './offlineCopyId'
import {
  createStrongLexiconModuleDownloadItem,
  createStrongLexiconModuleDownloadPlan,
} from './strongLexiconDownloadItems'
import type { StrongLexiconModuleId } from './strongLexiconPublications'
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
  // BHG is delivered without a revision of its own: the catalog entry of its archive names it.
  const declaredTextIdentity = isInterlinearCapableBibleVersion(versionId)
    ? getInterlinearBiblePublication().text.text
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
    ...(declaredTextIdentity ? { declaredTextIdentity } : {}),
  }
}

export function createInterlinearSidecarDownloadItem(lang: ResourceLanguage): DownloadItem {
  const publication = getInterlinearBiblePublication()
  const artifact = publication.indexes[lang]
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
    interlinearDatasetId: publication.datasetId,
    addedAt: Date.now(),
    retryCount: 0,
  }
}

type InstalledArchiveReader = (resourceId: string) => { archiveSha256?: string } | undefined

const BHG_TEXT_ID = createOfflineCopyId({ kind: 'bible', versionId: 'BHG' })
const INTERLINEAR_LANGUAGES: ResourceLanguage[] = ['fr', 'en']

/**
 * Brings the BHG text and its indexes to the catalog revision together (ADR-0079). An index is
 * built for one text: downloading an index first brings the text the catalog publishes with it,
 * and downloading the text brings every installed index along. The reader never applies an
 * index to another text in between; this only spares it the wait for a second download.
 */
export const completeInterlinearDownloadPlan = (
  items: DownloadItem[],
  readInstalled: InstalledArchiveReader = resourceId => resourcePublicationStore.read(resourceId)
): DownloadItem[] => {
  const hasIndex = items.some(item => item.type === 'bible-interlinear-sidecar')
  const hasText = items.some(item => item.id === BHG_TEXT_ID)
  if (!hasIndex && !hasText) return items

  const publication = getInterlinearBiblePublication()
  const textIsCurrent = readInstalled(BHG_TEXT_ID)?.archiveSha256 === publication.text.archiveSha256
  const bringsText = hasText || !textIsCurrent
  const plan = [...items]
  if (!hasText && bringsText) {
    plan.splice(
      plan.findIndex(item => item.type === 'bible-interlinear-sidecar'),
      0,
      createBibleDownloadItem('BHG')
    )
  }
  if (bringsText) {
    for (const language of INTERLINEAR_LANGUAGES) {
      const index = createInterlinearSidecarDownloadItem(language)
      const installed = readInstalled(index.id)
      if (
        installed &&
        installed.archiveSha256 !== publication.indexes[language].archiveSha256 &&
        !plan.some(item => item.id === index.id)
      ) {
        plan.push(index)
      }
    }
  }
  return bringsText
    ? plan.map(item =>
        item.type === 'bible-interlinear-sidecar' ? { ...item, dependsOnId: BHG_TEXT_ID } : item
      )
    : plan
}

export const createInterlinearSidecarDownloadPlan = (
  lang: ResourceLanguage,
  availabilityStatus: InterlinearSidecarAvailability['status']
): DownloadItem[] => {
  const sidecar = createInterlinearSidecarDownloadItem(lang)
  if (availabilityStatus !== 'base-missing' && availabilityStatus !== 'base-incompatible') {
    return completeInterlinearDownloadPlan([sidecar])
  }
  const bible = createBibleDownloadItem('BHG')
  return completeInterlinearDownloadPlan([bible, { ...sidecar, dependsOnId: bible.id }])
}

export function createStrongSidecarDownloadItem(versionId: StrongBibleVersionId): DownloadItem {
  const version = versions[versionId]
  const publication = getStrongBiblePublication(versionId)
  const strongArtifact = publication.strong
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

/**
 * `lexiconModuleId` names the Strong lexicon to acquire with the index when the reader has
 * none installed: Strong numbers open their entry without a connection only with a lexicon.
 */
export const createStrongSidecarDownloadPlan = (
  versionId: StrongBibleVersionId,
  availabilityStatus: StrongBibleSidecarAvailability['status'],
  lexiconModuleId?: StrongLexiconModuleId
): DownloadItem[] => {
  const sidecar = createStrongSidecarDownloadItem(versionId)
  const lexicon = lexiconModuleId ? [createStrongLexiconModuleDownloadItem(lexiconModuleId)] : []
  if (availabilityStatus !== 'base-missing' && availabilityStatus !== 'base-incompatible') {
    return [sidecar, ...lexicon]
  }

  const bible = createBibleDownloadItem(versionId)
  return [bible, { ...sidecar, dependsOnId: bible.id }, ...lexicon]
}

export const dedupeDownloadItems = (items: DownloadItem[]): DownloadItem[] => [
  ...new Map(items.map(item => [item.id, item])).values(),
]

type OfflineCopyDownloadPlanContext = {
  availabilityStatus?:
    | StrongBibleSidecarAvailability['status']
    | InterlinearSidecarAvailability['status']
  isStrongLexiconCoreAvailable?: boolean
  isDictionaryDirectoryAvailable?: boolean
  strongIndexLexiconModuleId?: StrongLexiconModuleId
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
    case 'dictionary':
      return createDictionaryDownloadItem(identity)
    case 'dictionary-directory':
      return createDictionaryDirectoryDownloadItem()
    case 'commentary':
      return createCommentaryDownloadItem(identity)
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
      return completeInterlinearDownloadPlan([createBibleDownloadItem(identity.versionId)])
    case 'strong-bible-index':
      return createStrongSidecarDownloadPlan(
        identity.versionId,
        (context.availabilityStatus as StrongBibleSidecarAvailability['status'] | undefined) ??
          'base-missing',
        context.strongIndexLexiconModuleId
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
    case 'dictionary':
      return createDictionaryDownloadPlan(identity, context.isDictionaryDirectoryAvailable ?? false)
    case 'dictionary-directory':
      return [createDictionaryDirectoryDownloadItem()]
    case 'commentary':
      return [createCommentaryDownloadItem(identity)]
    case 'database':
      return [createDatabaseDownloadItem(identity.databaseId, identity.language)]
    case 'bible-pericope':
    case 'bible-red-words':
      return [createBibleDownloadItem(identity.versionId)]
  }
}

export function createDictionaryDirectoryDownloadItem(): DownloadItem {
  const catalogArtifact = getMobileResourceCatalogEntry('dictionary-directory')
  return {
    id: 'dictionary-directory',
    type: 'dictionary-directory',
    name: 'Dictionary Directory',
    url: catalogArtifact.url,
    destinationPath: getDictionaryDirectoryDbPath(),
    archiveEntry: catalogArtifact.entry,
    estimatedSize: catalogArtifact.archiveBytes,
    expectedArchiveSha256: catalogArtifact.archiveSha256,
    addedAt: Date.now(),
    retryCount: 0,
  }
}

export const createDictionaryDownloadPlan = (
  identity: Extract<OfflineCopyIdentity, { kind: 'dictionary' }>,
  isDirectoryAvailable = false
): DownloadItem[] => {
  if (isDirectoryAvailable) return [createDictionaryDownloadItem(identity)]
  const directory = createDictionaryDirectoryDownloadItem()
  return [directory, { ...createDictionaryDownloadItem(identity), dependsOnId: directory.id }]
}

export function createDictionaryDownloadItem(
  identity: Extract<
    OfflineCopyIdentity,
    {
      kind: 'dictionary'
    }
  >
): DownloadItem {
  const catalogArtifact = getMobileResourceCatalogEntry(getOfflineCopyCatalogId(identity))
  return {
    id: createOfflineCopyId(identity),
    type: 'dictionary',
    name: identity.work,
    work: identity.work,
    resourceId: identity.resourceId,
    lang: identity.language,
    url: catalogArtifact.url,
    destinationPath: getDictionaryDbPath(identity.work, identity.language),
    archiveEntry: catalogArtifact.entry,
    estimatedSize: catalogArtifact.archiveBytes,
    expectedArchiveSha256: catalogArtifact.archiveSha256,
    addedAt: Date.now(),
    retryCount: 0,
  }
}

export function createCommentaryDownloadItem(
  identity: Extract<OfflineCopyIdentity, { kind: 'commentary' }>,
  name = identity.resourceId
): DownloadItem {
  const catalogArtifact = getMobileResourceCatalogEntry(createOfflineCopyId(identity))
  return {
    id: createOfflineCopyId(identity),
    type: 'commentary',
    name,
    resourceId: identity.resourceId,
    lang: identity.language,
    url: catalogArtifact.url,
    destinationPath: getCommentaryDbPath(identity.resourceId, identity.language),
    archiveEntry: catalogArtifact.entry,
    estimatedSize: catalogArtifact.archiveBytes,
    expectedArchiveSha256: catalogArtifact.archiveSha256,
    addedAt: Date.now(),
    retryCount: 0,
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
