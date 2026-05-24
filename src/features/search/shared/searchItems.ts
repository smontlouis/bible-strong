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
import type { Note, Study } from '~redux/modules/user'
import type { SearchEntityResult, SearchReferenceMode } from './searchResultTypes'

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
  return {
    type: 'strong',
    language: isGreek ? 'greek' : 'hebrew',
    code: getStrongCode(strong),
    label: strong.Mot,
    originalWord: getStrongOriginalWord(strong),
  }
}

export const getNaveEndpoint = (
  nave: NaveSearchItemRow
): NonNullable<SearchEntityResult['endpoint']> => ({
  type: 'nave',
  nameLower: nave.name_lower,
  label: nave.name,
})

export const getDictionaryEndpoint = (
  dictionary: DictionarySearchRow
): NonNullable<SearchEntityResult['endpoint']> => ({
  type: 'dictionary',
  word: dictionary.word,
  label: dictionary.word,
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
      endpoint: {
        type: 'note',
        noteId,
        label: title,
      },
    }
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
      endpoint: {
        type: 'study',
        studyId: id,
        label: title,
      },
    }
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
      endpoint: {
        type: 'verse',
        verseKeys,
      },
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
