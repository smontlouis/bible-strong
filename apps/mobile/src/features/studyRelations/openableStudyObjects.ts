import { getBook } from '~helpers/bibleBookCatalog'
import { getBibleReferenceLocation } from '~helpers/bibleReferenceLocation'
import type { SearchResult } from '~helpers/biblesDb'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'
import type { RelationEndpoint } from './domain'
import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'

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
  endChapter?: number
  endVerse?: number
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

export const getBibleViewParamsForSearchResult = (result: BibleViewSearchResult) => {
  const lastVerse = result.endChapter === result.chapter ? result.endVerse : undefined
  const focusVerses = Array.from(
    { length: lastVerse && lastVerse >= result.verse ? lastVerse - result.verse + 1 : 1 },
    (_, index) => result.verse + index
  )
  return {
    contextDisplayMode: 'focused',
    book: JSON.stringify(getBook(result.book)),
    chapter: String(result.chapter),
    verse: String(result.verse),
    version: result.version,
    focusVerses: JSON.stringify(focusVerses),
  }
}

export const getOpenableActionForRelationEndpoint = (
  endpoint: RelationEndpoint,
  data: { wordAnnotations?: WordAnnotationsObj } = {}
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
    case 'annotation': {
      const annotation = data.wordAnnotations?.[endpoint.annotationId]
      if (!annotation?.ranges.length) {
        return { type: 'toast', messageKey: 'Annotation introuvable' }
      }
      return {
        type: 'route',
        pathname: '/bible-view',
        params: {
          ...getBibleViewParamsForVerseKeys(
            annotation.ranges.map(range => range.verseKey),
            annotation.version
          ),
        },
      }
    }
    case 'word':
      return { type: 'none' }
  }
}

export const getOpenableAction = (
  object: OpenableStudyObject,
  data: { wordAnnotations?: WordAnnotationsObj } = {}
): OpenableStudyObjectAction => {
  if ('passage' in object && object.passage) {
    return {
      type: 'route',
      pathname: '/bible-view',
      params: getBibleViewParamsForSearchResult(object.passage),
    }
  }

  if ('strongReference' in object && object.strongReference) {
    return {
      type: 'route',
      pathname: '/strong',
      params: {
        book: object.strongReference.language === 'hebrew' ? '1' : '40',
        reference: object.strongReference.code,
      },
    }
  }

  if ('endpoint' in object && object.endpoint) {
    return getOpenableActionForRelationEndpoint(object.endpoint, data)
  }

  return { type: 'none' }
}
