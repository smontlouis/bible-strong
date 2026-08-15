import type { QueryKey } from '@tanstack/react-query'
import { resourceQueryKeys } from './resourceQueryKeys'

import { versions } from './bibleVersions'
import {
  LANGUAGE_SPECIFIC_DBS,
  SHARED_DBS,
  type DatabaseId,
  type ResourceLanguage,
} from './databaseTypes'
import type { StrongBiblePublication, StrongBibleVersionId } from './strongBiblePublications'
import { isStrongCapableBibleVersion } from './strongBiblePublications'
import type {
  InterlinearBiblePublication,
  InterlinearPublicationArtifact,
} from './interlinearBiblePublications'
import type {
  StrongLexiconModuleId,
  StrongLexiconPublicationArtifact,
} from './strongLexiconPublications'
import { createOfflineCopyId, type OfflineCopyId, type OfflineCopyIdentity } from './offlineCopyId'
export { createOfflineCopyId, type OfflineCopyId, type OfflineCopyIdentity } from './offlineCopyId'

const DATABASE_IDS = new Set<DatabaseId>([...LANGUAGE_SPECIFIC_DBS, ...SHARED_DBS])
const RESOURCE_LANGUAGES = new Set<ResourceLanguage>(['fr', 'en'])
const STRONG_LEXICON_MODULE_IDS = new Set<StrongLexiconModuleId>(['core', 'resources', 'entities'])
const DATABASE_DOMAIN_QUERY_KEYS: Record<Exclude<DatabaseId, 'BIBLES'>, QueryKey[]> = {
  DICTIONNAIRE: [
    ['dictionary'],
    ['resource-results', 'dictionary'],
    ['dictionary-detail'],
    ['dictionaryWords'],
    ['words'],
    ['home-dictionary-random'],
    ['sqlite-dictionary-search'],
    ['relation-dictionary-targets'],
  ],
  NAVE: [
    ['nave'],
    ['resource-results', 'nave'],
    ['nave-detail'],
    ['home-nave-random'],
    ['sqlite-nave-search'],
    ['relation-nave-targets'],
  ],
  TRESOR: [['commentaries']],
  MHY: [['commentaries']],
  TIMELINE: [['timeline']],
}

export const parseOfflineCopyId = (id: string): OfflineCopyIdentity | undefined => {
  const parts = id.split(':')
  if (parts[0] === 'bible' && parts.length === 2) {
    const versionId = parts[1]
    return versionId && Object.prototype.hasOwnProperty.call(versions, versionId)
      ? { kind: 'bible', versionId }
      : undefined
  }

  if (parts[0] === 'bible-strong' && parts.length === 2) {
    const versionId = parts[1]
    return isStrongCapableBibleVersion(versionId)
      ? { kind: 'strong-bible-index', versionId }
      : undefined
  }

  if ((parts[0] === 'bible-pericope' || parts[0] === 'bible-red-words') && parts.length === 2) {
    const versionId = parts[1]
    if (!versionId || !Object.prototype.hasOwnProperty.call(versions, versionId)) return undefined
    return parts[0] === 'bible-pericope'
      ? { kind: 'bible-pericope', versionId }
      : { kind: 'bible-red-words', versionId }
  }

  if (parts[0] === 'bible-interlinear' && parts.length === 3) {
    const language = parts[2] as ResourceLanguage
    return parts[1] === 'BHG' && RESOURCE_LANGUAGES.has(language)
      ? { kind: 'interlinear-index', versionId: 'BHG', language }
      : undefined
  }

  if (parts[0] === 'strong-lexicon' && parts.length === 2) {
    const moduleId = parts[1] as StrongLexiconModuleId
    return STRONG_LEXICON_MODULE_IDS.has(moduleId)
      ? { kind: 'strong-lexicon-module', moduleId }
      : undefined
  }

  if (parts[0] === 'database' && parts.length === 3) {
    const databaseId = parts[1] as DatabaseId
    const language = parts[2] as ResourceLanguage
    return databaseId !== 'BIBLES' &&
      DATABASE_IDS.has(databaseId) &&
      RESOURCE_LANGUAGES.has(language)
      ? {
          kind: 'database',
          databaseId: databaseId as Exclude<DatabaseId, 'BIBLES'>,
          language,
        }
      : undefined
  }

  return undefined
}

export const getOfflineCopyInvalidationKeys = (identity: OfflineCopyIdentity): QueryKey[] => {
  const publicationKey: QueryKey = ['resource-publication', createOfflineCopyId(identity)]
  switch (identity.kind) {
    case 'strong-lexicon-module':
      return [
        resourceQueryKeys.lexiconBible(),
        resourceQueryKeys.strongLexicon(),
        ['resource-results', 'strong-lexicon'],
        ['strong-lexicon'],
        ['strong-lexicon-entry'],
        ['strong-detail'],
        ['home-strong-random'],
        ['sqlite-strong-search'],
        ['relation-strong-targets'],
        publicationKey,
      ]
    case 'bible':
      return [
        resourceQueryKeys.bibleContent(),
        resourceQueryKeys.lexiconBible(),
        resourceQueryKeys.strongBible(),
        ['bible'],
        ['strong-detail'],
        ['bible-version-coverage', identity.versionId],
        ['downloaded-bible-version-ids'],
        ['strong-mode-availability', identity.versionId],
        publicationKey,
      ]
    case 'strong-bible-index':
      return [
        resourceQueryKeys.bibleContent(),
        resourceQueryKeys.lexiconBible(),
        resourceQueryKeys.strongBible(),
        ['bible'],
        ['strong-detail'],
        ['strong-index-availability', identity.versionId],
        ['strong-mode-availability', identity.versionId],
        publicationKey,
      ]
    case 'interlinear-index':
      return [
        resourceQueryKeys.bibleContent(),
        resourceQueryKeys.lexiconBible(),
        ['bible'],
        ['interlinear-index-availability', identity.language],
        ['interlinear-mode-availability'],
        ['strong-mode-availability'],
        publicationKey,
      ]
    case 'database':
      return [
        ...(identity.databaseId === 'MHY' || identity.databaseId === 'TRESOR'
          ? [resourceQueryKeys.bibleContent()]
          : []),
        resourceQueryKeys.offlineDatabaseAvailability(identity.databaseId, identity.language),
        ...DATABASE_DOMAIN_QUERY_KEYS[identity.databaseId],
        publicationKey,
      ]
    case 'bible-pericope':
    case 'bible-red-words':
      return [
        resourceQueryKeys.bibleContent(),
        ['bible'],
        ['bible-version-coverage', identity.versionId],
        publicationKey,
      ]
  }
}

type DownloadItemCommon = {
  id: OfflineCopyId
  name: string
  url: string
  estimatedSize: number
  expectedArchiveSha256?: string
  dependsOnId?: OfflineCopyId
  addedAt: number
  retryCount: number
}

export type BibleDownloadItem = DownloadItemCommon & {
  type: 'bible'
  versionId: string
  destinationPath?: string
  archiveEntry: string
  archiveEntries: {
    canonical: string
    pericope?: string
    redWords?: string
  }
  canonicalArtifact?: StrongBiblePublication['canonical']
  archiveArtifact?: InterlinearPublicationArtifact
}

export type StrongBibleIndexDownloadItem = DownloadItemCommon & {
  type: 'bible-strong-sidecar'
  versionId: StrongBibleVersionId
  strongArtifact: StrongBiblePublication['strong']
  strongDatasetId: StrongBiblePublication['datasetId']
}

export type InterlinearIndexDownloadItem = DownloadItemCommon & {
  type: 'bible-interlinear-sidecar'
  versionId: 'BHG'
  lang: ResourceLanguage
  interlinearArtifact: InterlinearPublicationArtifact
  interlinearDatasetId: InterlinearBiblePublication['datasetId']
}

export type StrongLexiconModuleDownloadItem = DownloadItemCommon & {
  type: 'strong-lexicon-module'
  strongLexiconModuleId: StrongLexiconModuleId
  strongLexiconArtifact: StrongLexiconPublicationArtifact
}

export type DatabaseDownloadItem = DownloadItemCommon & {
  type: 'database'
  databaseId: Exclude<DatabaseId, 'BIBLES'>
  lang: ResourceLanguage
  destinationPath: string
  archiveEntry: string
}

export type DownloadItem =
  | BibleDownloadItem
  | StrongBibleIndexDownloadItem
  | InterlinearIndexDownloadItem
  | StrongLexiconModuleDownloadItem
  | DatabaseDownloadItem

export type DownloadItemType = DownloadItem['type']

export const getDownloadItemIdentity = (item: DownloadItem): OfflineCopyIdentity => {
  switch (item.type) {
    case 'bible':
      return { kind: 'bible', versionId: item.versionId }
    case 'bible-strong-sidecar':
      return { kind: 'strong-bible-index', versionId: item.versionId }
    case 'bible-interlinear-sidecar':
      return { kind: 'interlinear-index', versionId: 'BHG', language: item.lang }
    case 'strong-lexicon-module':
      return { kind: 'strong-lexicon-module', moduleId: item.strongLexiconModuleId }
    case 'database':
      return { kind: 'database', databaseId: item.databaseId, language: item.lang }
  }
}
