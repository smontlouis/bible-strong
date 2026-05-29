import booksDesc from '~assets/bible_versions/books-desc'
import { parseBibleReference } from '~features/search/BibleReferenceWidget'
import type { SearchResult } from '~helpers/biblesDb'
import { deltaToPlainText } from '~helpers/deltaToPlainText'
import formatVerseContent from '~helpers/formatVerseContent'
import type { DictionnaireSearchRow } from '~helpers/loadDictionnaireBySearch'
import type { DictionnaireLetterRow } from '~helpers/loadDictionnaireByLetter'
import type { LexiqueRow } from '~helpers/loadLexiqueByLetter'
import type { NaveLetterRow } from '~helpers/loadNaveByLetter'
import type { NaveSearchRow } from '~helpers/loadNaveBySearch'
import i18n from '~i18n'
import type { Link, Note, Study } from '~redux/modules/user'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import type { SearchEntityResult, SearchReferenceMode } from './searchResultTypes'
import {
  createDictionaryEndpoint,
  createExternalLinkEndpointFromLink,
  createNaveEndpoint,
  createNoteEndpoint,
  createStrongEndpoint,
  createStudyEndpoint,
  createVerseEndpoint,
} from '~features/studyRelations/endpoints'

export type DictionarySearchRow = DictionnaireSearchRow | DictionnaireLetterRow
export type NaveSearchItemRow = NaveSearchRow | NaveLetterRow
type Translate = (key: string) => string

const translate: Translate = key => i18n.t(key)

export const createVerseKeys = (
  book: number,
  chapter: number,
  startVerse: number,
  endVerse: number
) =>
  Array.from(
    { length: endVerse - startVerse + 1 },
    (_, index) => `${book}-${chapter}-${startVerse + index}`
  )

export const getStrongCode = (strong: LexiqueRow) =>
  String(
    (strong as LexiqueRow & { code?: string | number }).Code ??
      (strong as { code?: string | number }).code ??
      ''
  )

export const getStrongOriginalWord = (strong: LexiqueRow) =>
  'Grec' in strong ? strong.Grec : strong.Hebreu

export const isGreekStrong = (strong: LexiqueRow) => 'Grec' in strong

export const getStrongEndpoint = (
  strong: LexiqueRow
): NonNullable<SearchEntityResult['endpoint']> => {
  const isGreek = isGreekStrong(strong)
  return createStrongEndpoint({
    language: isGreek ? 'greek' : 'hebrew',
    code: getStrongCode(strong),
    labelFallback: strong.Mot,
    originalWord: getStrongOriginalWord(strong),
  })
}

export const getNaveEndpoint = (
  nave: NaveSearchItemRow
): NonNullable<SearchEntityResult['endpoint']> => ({
  ...createNaveEndpoint({ nameLower: nave.name_lower, labelFallback: nave.name }),
})

export const getDictionaryEndpoint = (
  dictionary: DictionarySearchRow
): NonNullable<SearchEntityResult['endpoint']> => ({
  ...createDictionaryEndpoint({ word: dictionary.word, labelFallback: dictionary.word }),
})

export const getDictionaryResultKey = (dictionary: DictionarySearchRow, index?: number) =>
  [
    'dictionary',
    dictionary.rowid ?? dictionary.sanitized_word ?? dictionary.word,
    dictionary.word,
    index,
  ]
    .filter(value => value !== undefined && value !== null && value !== '')
    .join(':')

export const getNoteSearchItems = (notes: Record<string, Note> = {}, t: Translate = translate) =>
  Object.entries(notes).map<SearchEntityResult>(([noteId, note]) => {
    const title = note.title || note.description || t('Note sans titre')
    return {
      id: `note:${noteId}`,
      type: 'notes',
      iconType: 'notes',
      title,
      subtitle: t('Note'),
      description: note.description,
      endpoint: createNoteEndpoint(noteId, title),
    }
  })

export const getSortedNoteSearchItems = (
  notes: Record<string, Note> = {},
  t: Translate = translate
) =>
  getNoteSearchItems(notes, t).sort((a, b) => {
    const left = notes[(a.endpoint as Extract<RelationEndpoint, { type: 'note' }>).noteId]
    const right = notes[(b.endpoint as Extract<RelationEndpoint, { type: 'note' }>).noteId]
    return Number(right?.date || 0) - Number(left?.date || 0)
  })

const getLinkTitle = (link: Link, t: Translate = translate) =>
  link.customTitle || link.ogData?.title || link.url || t('Lien sans titre')

export const getLinkSearchItems = (links: Record<string, Link> = {}, t: Translate = translate) =>
  Object.entries(links).map<SearchEntityResult>(([linkId, link]) => {
    const title = getLinkTitle(link, t)
    const description = link.ogData?.description || link.url

    return {
      id: `link:${linkId}`,
      type: 'links',
      iconType: 'links',
      title,
      subtitle: t('Lien'),
      description,
      endpoint: createExternalLinkEndpointFromLink(linkId, link),
    }
  })

export const getSortedLinkSearchItems = (
  links: Record<string, Link> = {},
  t: Translate = translate
) =>
  getLinkSearchItems(links, t).sort((a, b) => {
    const left = links[(a.endpoint as Extract<RelationEndpoint, { type: 'externalLink' }>).linkId]
    const right = links[(b.endpoint as Extract<RelationEndpoint, { type: 'externalLink' }>).linkId]
    return Number(right?.date || 0) - Number(left?.date || 0)
  })

export const getStudySearchItems = (
  studies: Record<string, Study> = {},
  t: Translate = translate
) =>
  Object.entries(studies).map<SearchEntityResult>(([studyId, study]) => {
    const id = study.id || studyId
    const title = study.title || t('Étude sans titre')
    const description = study.content?.ops
      ? deltaToPlainText(study.content.ops as Parameters<typeof deltaToPlainText>[0])
      : undefined
    return {
      id: `study:${id}`,
      type: 'studies',
      iconType: 'studies',
      title,
      subtitle: t('Étude'),
      description,
      endpoint: createStudyEndpoint(id, title),
    }
  })

export const getSortedStudySearchItems = (
  studies: Record<string, Study> = {},
  t: Translate = translate
) =>
  getStudySearchItems(studies, t).sort((a, b) => {
    const left = studies[(a.endpoint as Extract<RelationEndpoint, { type: 'study' }>).studyId]
    const right = studies[(b.endpoint as Extract<RelationEndpoint, { type: 'study' }>).studyId]
    return Number(right?.modified_at || 0) - Number(left?.modified_at || 0)
  })

export const getReferenceSearchItems = (
  query: string,
  options: { mode: SearchReferenceMode } = { mode: 'navigation' }
): SearchEntityResult[] =>
  parseBibleReference(query).map((segment, index) => {
    const startVerse = segment.startVerse
    const endVerse = options.mode === 'target' && segment.isWholeChapter ? 1 : segment.endVerse
    const isWholeChapter = options.mode === 'navigation' && segment.isWholeChapter
    const verseKeys = createVerseKeys(segment.book, segment.chapter, startVerse, endVerse)
    const verseCount = endVerse - startVerse + 1
    const verseIds = Array.from({ length: verseCount }, (_, i) => ({
      Livre: segment.book,
      Chapitre: segment.chapter,
      Verset: startVerse + i,
    }))
    const title = isWholeChapter
      ? `${i18n.t(booksDesc[segment.book - 1]?.Nom)} ${segment.chapter}`
      : formatVerseContent(verseIds).title

    return {
      id: `reference:${verseKeys.join('/')}:${index}`,
      type: 'passages',
      iconType: 'passages',
      title,
      referenceSegment: {
        ...segment,
        startVerse,
        endVerse,
        isWholeChapter,
      },
      endpoint: createVerseEndpoint(verseKeys),
    }
  })

export const getStrongSearchItems = (results: LexiqueRow[], t: Translate = translate) =>
  results.map<SearchEntityResult>(strong => {
    const code = getStrongCode(strong)
    const isGreek = isGreekStrong(strong)
    const prefix = isGreek ? 'G' : 'H'
    return {
      id: `strong:${strong.lexiqueType}:${code}:${strong.Mot}`,
      type: 'strong',
      iconType: 'strong',
      title: strong.Mot,
      chip: `${prefix}${code}`,
      subtitle: t(strong.lexiqueType),
      description: getStrongOriginalWord(strong),
      endpoint: getStrongEndpoint(strong),
    }
  })

export const getDictionarySearchItems = (results: DictionarySearchRow[]) =>
  results.map<SearchEntityResult>((dictionary, index) => ({
    id: getDictionaryResultKey(dictionary, index),
    type: 'dictionary',
    iconType: 'dictionary',
    title: dictionary.word,
    subtitle: i18n.t('Dictionnaire'),
    endpoint: getDictionaryEndpoint(dictionary),
  }))

export const getNaveSearchItems = (results: NaveSearchItemRow[]) =>
  results.map<SearchEntityResult>(nave => ({
    id: `nave:${nave.name_lower}`,
    type: 'nave',
    iconType: 'nave',
    title: nave.name,
    subtitle: i18n.t('Nave'),
    endpoint: getNaveEndpoint(nave),
  }))

export const getPassageSearchItems = (results: SearchResult[]) =>
  results.map<SearchEntityResult>(result => {
    const { title } = formatVerseContent([
      { Livre: result.book, Chapitre: result.chapter, Verset: result.verse },
    ])

    return {
      id: `passage:${result.version}:${result.book}:${result.chapter}:${result.verse}`,
      type: 'passages',
      iconType: 'passages',
      title,
      subtitle: result.version,
      description: result.highlighted,
      passage: result,
    }
  })
