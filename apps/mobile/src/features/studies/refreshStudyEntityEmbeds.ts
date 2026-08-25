import type { JSONValue } from 'expo/build/dom/dom.types'
import {
  getLinkSearchItems,
  getNoteSearchItems,
  getStudySearchItems,
} from '~features/search/shared/searchItems'
import type { SearchEntityResultWithEndpoint } from '~features/search/shared/searchResultTypes'
import type { ResourceAccessRegistry } from '~features/resources/resourceAccess'
import { getAnnotationTargetItems } from '~features/studyRelations/targetSearch'
import { endpointIdentity, type RelationEndpoint } from '~features/studyRelations/domain'
import { createStrongIdentity } from '~helpers/strongIdentities'
import verseToReference from '~helpers/verseToReference'
import type { Study, LinksObj, NotesObj, StudiesObj } from '~redux/modules/user'
import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import type { ResourcesLanguageState } from '~state/resourcesLanguage'
import {
  getStudyEntityTypeLabel,
  type StudyEntityDisplay,
  type StudyEntityEmbedPayload,
} from './studyEntityEmbeds'

type RefreshDependencies = {
  resources: Pick<ResourceAccessRegistry, 'bibleContent' | 'strongLexicon' | 'nave' | 'dictionary'>
  defaultBibleVersion: string
  resourceLanguages: ResourcesLanguageState
  notes?: NotesObj
  links?: LinksObj
  studies?: StudiesObj
  wordAnnotations?: WordAnnotationsObj
}

const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()

const getSupportedResourceLanguage = (value: string | undefined, fallback: 'en' | 'fr') =>
  value === 'en' || value === 'fr' ? value : fallback

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isStudyEntityEmbedPayload = (value: unknown): value is StudyEntityEmbedPayload =>
  isRecord(value) &&
  value.schemaVersion === 1 &&
  isRecord(value.endpoint) &&
  typeof value.endpoint.type === 'string' &&
  isRecord(value.fallback) &&
  typeof value.fallback.title === 'string'

const displayFromTarget = (target: SearchEntityResultWithEndpoint): StudyEntityDisplay => ({
  typeLabel: getStudyEntityTypeLabel(target.endpoint),
  title: target.title,
  ...(target.subtitle && { subtitle: target.subtitle }),
  ...(target.description && { description: target.description }),
  ...(target.chip && { chip: target.chip }),
})

const getCurrentLocalTargets = (dependencies: RefreshDependencies) =>
  [
    ...getNoteSearchItems(dependencies.notes),
    ...getLinkSearchItems(dependencies.links),
    ...getStudySearchItems(dependencies.studies),
    ...getAnnotationTargetItems(dependencies.wordAnnotations),
  ].reduce((targets, target) => {
    if (target.endpoint)
      targets.set(endpointIdentity(target.endpoint), target as SearchEntityResultWithEndpoint)
    return targets
  }, new Map<string, SearchEntityResultWithEndpoint>())

const resolveResourceDisplay = async (
  endpoint: RelationEndpoint,
  dependencies: RefreshDependencies
): Promise<Omit<StudyEntityDisplay, 'typeLabel'> | undefined> => {
  switch (endpoint.type) {
    case 'verse': {
      const version = endpoint.version || dependencies.defaultBibleVersion
      const texts = await dependencies.resources.bibleContent.loadVerseTexts({
        version,
        verseKeys: endpoint.verseKeys,
      })
      const description = endpoint.verseKeys
        .map(key => texts[key])
        .filter(Boolean)
        .join(' ')
      return {
        title: verseToReference(endpoint.verseKeys),
        subtitle: version,
        ...(description && { description }),
      }
    }
    case 'strong': {
      const [preview] = await dependencies.resources.strongLexicon.loadPreview(
        [createStrongIdentity(endpoint.code, endpoint.language)],
        dependencies.resourceLanguages.STRONG
      )
      if (!preview) return undefined
      return {
        title: preview.gloss,
        subtitle: preview.transliteration || (endpoint.language === 'greek' ? 'Grec' : 'Hébreu'),
        chip: preview.stepCode,
        description: preview.original || undefined,
      }
    }
    case 'nave': {
      const topic = await dependencies.resources.nave.loadItem(
        endpoint.nameLower,
        getSupportedResourceLanguage(endpoint.resourceLanguage, dependencies.resourceLanguages.NAVE)
      )
      return topic
        ? { title: topic.name, subtitle: 'Nave', description: stripHtml(topic.description) }
        : undefined
    }
    case 'dictionary':
    case 'word': {
      const entry = await dependencies.resources.dictionary.loadItem(
        endpoint.word,
        getSupportedResourceLanguage(
          endpoint.resourceLanguage,
          dependencies.resourceLanguages.DICTIONNAIRE
        )
      )
      return entry
        ? {
            title: entry.word,
            subtitle: endpoint.type === 'word' ? 'Mot' : 'Dictionnaire',
            description: stripHtml(entry.definition),
          }
        : undefined
    }
    case 'note':
    case 'study':
    case 'externalLink':
    case 'annotation':
      return undefined
  }
}

export const refreshStudyEntityEmbedPayload = async (
  payload: StudyEntityEmbedPayload,
  dependencies: RefreshDependencies,
  localTargets = getCurrentLocalTargets(dependencies)
): Promise<StudyEntityEmbedPayload> => {
  const localTarget = localTargets.get(endpointIdentity(payload.endpoint))

  try {
    const display = localTarget
      ? displayFromTarget(localTarget)
      : await resolveResourceDisplay(payload.endpoint, dependencies)
    return {
      ...payload,
      display: display
        ? { ...display, typeLabel: getStudyEntityTypeLabel(payload.endpoint) }
        : payload.fallback,
    }
  } catch {
    return { ...payload, display: payload.fallback }
  }
}

export const refreshStudyEntityEmbeds = async (
  content: Study['content'],
  dependencies: RefreshDependencies
): Promise<Study['content']> => {
  if (!content?.ops) return content
  const localTargets = getCurrentLocalTargets(dependencies)

  const ops = await Promise.all(
    content.ops.map(async operation => {
      if (!isRecord(operation)) return operation
      const insert = isRecord(operation.insert) ? operation.insert : undefined
      const attributes = isRecord(operation.attributes) ? operation.attributes : undefined
      const blockPayload = insert?.['block-entity']
      const legacyInlinePayload = insert?.['inline-entity']
      const inlinePayload = attributes?.['inline-entity']
      const payload = isStudyEntityEmbedPayload(blockPayload)
        ? blockPayload
        : isStudyEntityEmbedPayload(inlinePayload)
          ? inlinePayload
          : isStudyEntityEmbedPayload(legacyInlinePayload)
            ? legacyInlinePayload
            : undefined
      if (!payload) return operation

      const refreshed = await refreshStudyEntityEmbedPayload(payload, dependencies, localTargets)
      if (payload === inlinePayload) {
        return {
          ...operation,
          attributes: { ...attributes, 'inline-entity': refreshed },
        } as JSONValue
      }

      if (payload === legacyInlinePayload) {
        return {
          insert: refreshed.display.title,
          attributes: { ...attributes, 'inline-entity': refreshed },
        } as JSONValue
      }

      return {
        ...operation,
        insert: { ...insert, 'block-entity': refreshed },
      } as JSONValue
    })
  )

  return { ...content, ops }
}
