import type { Verse } from '~common/types'
import type { SearchEntityResult } from './shared/searchResultTypes'
import { createVerseEndpoint } from '~features/studyRelations/endpoints'
import type { RelationTargetResult } from '~features/studyRelations/targetSearch'
import verseToReference from '~helpers/verseToReference'

export const isSelectableVersePassage = (item: SearchEntityResult) =>
  !item.referenceSegment?.isWholeChapter

export function getPassageSelectionRange(item: SearchEntityResult, version: string) {
  if (item.passage) {
    const result = item.passage
    return {
      version: result.version,
      book: result.book,
      chapter: result.chapter,
      endChapter: result.endChapter ?? result.chapter,
      startVerse: result.verse,
      endVerse: result.endVerse ?? result.verse,
    }
  }
  if (item.referenceSegment) {
    const segment = item.referenceSegment
    return {
      version: item.endpoint?.type === 'verse' ? (item.endpoint.version ?? version) : version,
      book: segment.book,
      chapter: segment.chapter,
      endChapter: segment.chapter,
      startVerse: segment.startVerse,
      endVerse: segment.isWholeChapter ? Infinity : segment.endVerse,
    }
  }
  if (item.endpoint?.type === 'verse') {
    const keys = item.endpoint.verseKeys
    const [book, chapter, startVerse] = keys[0].split('-').map(Number)
    const [, endChapter, endVerse] = keys[keys.length - 1].split('-').map(Number)
    return {
      version: item.endpoint.version ?? version,
      book,
      chapter,
      endChapter,
      startVerse,
      endVerse,
    }
  }
  return null
}

export const verseSelectionKey = (verse: Pick<Verse, 'Livre' | 'Chapitre' | 'Verset'>) =>
  `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`

export function isVerseInSelectionRange(
  verse: Verse,
  range: NonNullable<ReturnType<typeof getPassageSelectionRange>>
) {
  const chapter = Number(verse.Chapitre)
  const number = Number(verse.Verset)
  return (
    Number(verse.Livre) === range.book &&
    chapter >= range.chapter &&
    chapter <= range.endChapter &&
    (chapter !== range.chapter || number >= range.startVerse) &&
    (chapter !== range.endChapter || number <= range.endVerse)
  )
}

export function createPassageSelectionTarget(
  verseKeys: string[],
  version: string
): RelationTargetResult {
  const endpoint = createVerseEndpoint(verseKeys, undefined, version)
  if (endpoint.type !== 'verse') throw new Error('Expected a verse selection')
  return {
    id: `selection:${version}:${endpoint.verseKeys.join('/')}`,
    type: 'passages',
    iconType: 'passages',
    title: verseToReference(endpoint.verseKeys),
    subtitle: version,
    endpoint,
  }
}

/** Resolve the clicked result directly; never broaden it to the surrounding chapter. */
export async function resolvePassageTarget(
  item: SearchEntityResult,
  version: string,
  loadChapter: import('~features/resources/bibleContentAccess').BibleContentAccess['loadChapter']
): Promise<SearchEntityResult> {
  if (!isSelectableVersePassage(item)) throw new Error('Choose explicit verses, not a chapter')
  const range = getPassageSelectionRange(item, version)
  if (!range || item.type !== 'passages') return item
  let verseKeys: string[] = []
  if (range.chapter === range.endChapter && Number.isFinite(range.endVerse)) {
    verseKeys = Array.from(
      { length: range.endVerse - range.startVerse + 1 },
      (_, index) => `${range.book}-${range.chapter}-${range.startVerse + index}`
    )
  } else {
    for (let chapter = range.chapter; chapter <= range.endChapter; chapter++) {
      const result = await loadChapter({ version: range.version, book: range.book, chapter })
      if (!result.success) throw new Error(result.error.message)
      verseKeys.push(
        ...result.data.verses
          .filter(verse => isVerseInSelectionRange(verse, range))
          .map(verseSelectionKey)
      )
    }
  }
  if (!verseKeys.length) throw new Error('Passage unavailable')
  return { ...item, ...createPassageSelectionTarget(verseKeys, range.version) }
}
