import type { LinksObj, NotesObj, StudiesObj } from '~redux/modules/user'
import i18n from '~i18n'
import {
  getNoteSearchItems,
  getLinkSearchItems,
  getReferenceSearchItems,
  getSortedLinkSearchItems,
  getSortedNoteSearchItems,
  getSortedStudySearchItems,
  getStudySearchItems,
} from '~features/search/shared/searchItems'
import type { SearchEntityResultWithEndpoint } from '~features/search/shared/searchResultTypes'
import { createAnnotationEndpoint, createStrongEndpoint } from './endpoints'
import type { RelationEndpoint } from './domain'
import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import { getWordAnnotationText } from '~redux/modules/user/wordAnnotationRanges'
import verseToReference from '~helpers/verseToReference'
import { normalizeBibleSearchText, parseStrongReference } from '~helpers/bibleSearchInput'

export type RelationTargetResult = SearchEntityResultWithEndpoint

type SearchData = {
  notes?: NotesObj
  links?: LinksObj
  studies?: StudiesObj
  wordAnnotations?: WordAnnotationsObj
}

export const getAnnotationTargetItems = (
  wordAnnotations: WordAnnotationsObj = {}
): RelationTargetResult[] =>
  Object.values(wordAnnotations).map(annotation => {
    const title = getWordAnnotationText(annotation) || i18n.t('Annotation sans texte')
    const verseKeys = annotation.ranges.map(range => range.verseKey)
    return {
      id: `annotation:${annotation.id}`,
      type: 'passages',
      iconType: 'passages',
      title,
      subtitle: i18n.t('Annotation'),
      description: `${verseToReference(verseKeys)} · ${annotation.version}`,
      endpoint: createAnnotationEndpoint(annotation.id, title),
    }
  })

export const getSortedAnnotationTargetItems = (
  wordAnnotations: WordAnnotationsObj = {}
): RelationTargetResult[] =>
  getAnnotationTargetItems(wordAnnotations).sort((left, right) => {
    const leftId = (left.endpoint as Extract<RelationEndpoint, { type: 'annotation' }>).annotationId
    const rightId = (right.endpoint as Extract<RelationEndpoint, { type: 'annotation' }>)
      .annotationId
    return Number(wordAnnotations[rightId]?.date || 0) - Number(wordAnnotations[leftId]?.date || 0)
  })

const searchVerseTargets = (query: string): RelationTargetResult[] =>
  getReferenceSearchItems(query, { mode: 'target' })
    .filter((item): item is RelationTargetResult => Boolean(item.endpoint))
    .map(item => ({
      ...item,
      subtitle: undefined,
    }))

const searchStrongTargets = (query: string): RelationTargetResult[] => {
  const reference = parseStrongReference(query)
  if (!reference) return []

  const { language } = reference
  const endpoint = createStrongEndpoint({ language, code: String(reference.number) })
  const code = endpoint.code
  const prefix = language === 'greek' ? 'G' : 'H'

  return [
    {
      id: `strong:${language}:${code}`,
      type: 'strong',
      iconType: 'strong',
      title: `${prefix}${code}`,
      subtitle: language === 'greek' ? i18n.t('Strong grec') : i18n.t('Strong hébreu'),
      endpoint: createStrongEndpoint({ language, code, labelFallback: `${prefix}${code}` }),
    },
  ]
}

export const searchReferenceAndStrongTargets = (query: string): RelationTargetResult[] => {
  const trimmed = query.trim()
  if (!trimmed) return []

  return [...searchVerseTargets(trimmed), ...searchStrongTargets(trimmed)]
}

const normalizeText = normalizeBibleSearchText

export const getNoteTargetItems = (notes: NotesObj = {}): RelationTargetResult[] =>
  getNoteSearchItems(notes).filter((item): item is RelationTargetResult => Boolean(item.endpoint))

export const getLinkTargetItems = (links: LinksObj = {}): RelationTargetResult[] =>
  getLinkSearchItems(links).filter((item): item is RelationTargetResult => Boolean(item.endpoint))

export const getStudyTargetItems = (studies: StudiesObj = {}): RelationTargetResult[] =>
  getStudySearchItems(studies).filter((item): item is RelationTargetResult =>
    Boolean(item.endpoint)
  )

export const getSortedNoteTargetItems = (notes: NotesObj = {}): RelationTargetResult[] =>
  getSortedNoteSearchItems(notes).filter((item): item is RelationTargetResult =>
    Boolean(item.endpoint)
  )

export const getSortedLinkTargetItems = (links: LinksObj = {}): RelationTargetResult[] =>
  getSortedLinkSearchItems(links).filter((item): item is RelationTargetResult =>
    Boolean(item.endpoint)
  )

export const getSortedStudyTargetItems = (studies: StudiesObj = {}): RelationTargetResult[] =>
  getSortedStudySearchItems(studies).filter((item): item is RelationTargetResult =>
    Boolean(item.endpoint)
  )

const searchNoteTargets = (query: string, notes: NotesObj = {}): RelationTargetResult[] => {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  return getNoteTargetItems(notes)
    .filter(note => normalizeText(`${note.title} ${note.subtitle || ''}`).includes(normalizedQuery))
    .slice(0, 12)
}

const searchLinkTargets = (query: string, links: LinksObj = {}): RelationTargetResult[] => {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  return getLinkTargetItems(links)
    .filter(link =>
      normalizeText(`${link.title} ${link.description || ''}`).includes(normalizedQuery)
    )
    .slice(0, 12)
}

const searchStudyTargets = (query: string, studies: StudiesObj = {}): RelationTargetResult[] => {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  return getStudyTargetItems(studies)
    .filter(study => normalizeText(study.title).includes(normalizedQuery))
    .slice(0, 12)
}

const searchAnnotationTargets = (
  query: string,
  wordAnnotations: WordAnnotationsObj = {}
): RelationTargetResult[] => {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  return getAnnotationTargetItems(wordAnnotations)
    .filter(annotation =>
      normalizeText(`${annotation.title} ${annotation.description || ''}`).includes(normalizedQuery)
    )
    .slice(0, 12)
}

export const searchRelationTargets = (
  query: string,
  data: SearchData = {}
): RelationTargetResult[] => {
  const trimmed = query.trim()
  if (!trimmed) return []

  return [
    ...searchVerseTargets(trimmed),
    ...searchStrongTargets(trimmed),
    ...searchNoteTargets(trimmed, data.notes),
    ...searchLinkTargets(trimmed, data.links),
    ...searchStudyTargets(trimmed, data.studies),
    ...searchAnnotationTargets(trimmed, data.wordAnnotations),
  ]
}
