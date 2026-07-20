import { getBook } from '~helpers/bibleBookCatalog'
import { getBibleReferenceLocation } from '~helpers/bibleReferenceLocation'
import type { SearchResult } from '~helpers/biblesDb'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'
import type { RelationEndpoint } from './domain'

export type OpenableStudyObject =
  | { endpoint: RelationEndpoint; passage?: never }
  | { passage: SearchResult; endpoint?: never }
  | SearchEntityResult

export type OpenableStudyObjectAction =
  | { type: 'route'; pathname: string; params: Record<string, string> }
  | { type: 'note'; noteId: string }
  | { type: 'toast'; messageKey: string }
  | { type: 'none' }

type BibleViewSearchResult = {
  book: number
  chapter: number
  verse: number
  version: string
}

export const getBibleViewParamsForVerseKeys = (verseKeys: string[], version?: string) => {
  const { bookNumber, chapter, verse, focusVerses } = getBibleReferenceLocation(verseKeys)

  return {
    contextDisplayMode: 'focused',
    book: JSON.stringify(getBook(bookNumber)),
    chapter: String(chapter),
    verse: String(verse),
    focusVerses: JSON.stringify(focusVerses),
    ...(version && { version }),
  }
}

export const getBibleViewParamsForSearchResult = (result: BibleViewSearchResult) => ({
  contextDisplayMode: 'focused',
  book: JSON.stringify(getBook(result.book)),
  chapter: String(result.chapter),
  verse: String(result.verse),
  version: result.version,
  focusVerses: JSON.stringify([result.verse]),
})

export const getOpenableActionForRelationEndpoint = (
  endpoint: RelationEndpoint
): OpenableStudyObjectAction => {
  switch (endpoint.type) {
    case 'verse': {
      return {
        type: 'route',
        pathname: '/bible-view',
        params: getBibleViewParamsForVerseKeys(endpoint.verseKeys, endpoint.version),
      }
    }
    case 'note':
      return { type: 'note', noteId: endpoint.noteId }
    case 'study':
      return {
        type: 'route',
        pathname: '/edit-study',
        params: { studyId: endpoint.studyId },
      }
    case 'strong':
      return {
        type: 'route',
        pathname: '/strong',
        params: {
          book: endpoint.language === 'hebrew' ? '1' : '40',
          reference: endpoint.code,
        },
      }
    case 'nave':
      return {
        type: 'route',
        pathname: '/nave-detail',
        params: {
          name_lower: endpoint.nameLower,
          name: endpoint.labelFallback || endpoint.nameLower,
        },
      }
    case 'dictionary':
      return {
        type: 'route',
        pathname: '/dictionnary-detail',
        params: { word: endpoint.word },
      }
    case 'externalLink':
      if (!endpoint.linkId) {
        return { type: 'toast', messageKey: 'Lien introuvable' }
      }
      return {
        type: 'route',
        pathname: '/link',
        params: { linkId: endpoint.linkId },
      }
    case 'word':
      return { type: 'none' }
  }
}

export const getOpenableAction = (object: OpenableStudyObject): OpenableStudyObjectAction => {
  if ('passage' in object && object.passage) {
    return {
      type: 'route',
      pathname: '/bible-view',
      params: getBibleViewParamsForSearchResult(object.passage),
    }
  }

  if ('endpoint' in object && object.endpoint) {
    return getOpenableActionForRelationEndpoint(object.endpoint)
  }

  return { type: 'none' }
}
