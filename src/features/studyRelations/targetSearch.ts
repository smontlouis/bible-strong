import type { LinksObj, NotesObj, StudiesObj } from '~redux/modules/user'
import { normalizeStrongCode } from './domain'
import i18n from '~i18n'
import {
  getNoteSearchItems,
  getLinkSearchItems,
  getReferenceSearchItems,
  getStudySearchItems,
} from '~features/search/shared/searchItems'
import type { SearchEntityResultWithEndpoint } from '~features/search/shared/searchResultTypes'

export type RelationTargetResult = SearchEntityResultWithEndpoint

type SearchData = {
  notes?: NotesObj
  links?: LinksObj
  studies?: StudiesObj
}

const searchVerseTargets = (query: string): RelationTargetResult[] =>
  getReferenceSearchItems(query, { mode: 'target' })
    .filter((item): item is RelationTargetResult => Boolean(item.endpoint))
    .map(item => ({
      ...item,
      subtitle: undefined,
    }))

const searchStrongTargets = (query: string): RelationTargetResult[] => {
  const match = query.trim().match(/^([gh])\s*0*(\d+)$/i)
  if (!match) return []

  const language = match[1].toUpperCase() === 'G' ? 'greek' : 'hebrew'
  const code = normalizeStrongCode(match[2])
  const prefix = language === 'greek' ? 'G' : 'H'

  return [
    {
      id: `strong:${language}:${code}`,
      type: 'strong',
      iconType: 'strong',
      title: `${prefix}${code}`,
      subtitle: language === 'greek' ? i18n.t('Strong grec') : i18n.t('Strong hébreu'),
      endpoint: {
        type: 'strong',
        language,
        code,
        label: `${prefix}${code}`,
      },
    },
  ]
}

export const searchReferenceAndStrongTargets = (query: string): RelationTargetResult[] => {
  const trimmed = query.trim()
  if (!trimmed) return []

  return [...searchVerseTargets(trimmed), ...searchStrongTargets(trimmed)]
}

const normalizeText = (text: string) => text.toLowerCase().trim()

export const getNoteTargetItems = (notes: NotesObj = {}): RelationTargetResult[] =>
  getNoteSearchItems(notes).filter((item): item is RelationTargetResult => Boolean(item.endpoint))

export const getLinkTargetItems = (links: LinksObj = {}): RelationTargetResult[] =>
  getLinkSearchItems(links).filter((item): item is RelationTargetResult => Boolean(item.endpoint))

export const getStudyTargetItems = (studies: StudiesObj = {}): RelationTargetResult[] =>
  getStudySearchItems(studies).filter((item): item is RelationTargetResult =>
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
  ]
}
