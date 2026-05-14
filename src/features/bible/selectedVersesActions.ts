import type { Verse, VerseIds } from '~common/types'

export interface VerseLocation {
  book: number
  chapter: number
  verse: number
}

export const getVerseKey = (verse: Pick<Verse, 'Livre' | 'Chapitre' | 'Verset'>): string =>
  `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`

export const selectAllChapterVerses = (verses: Pick<Verse, 'Livre' | 'Chapitre' | 'Verset'>[]) =>
  Object.fromEntries(verses.map(verse => [getVerseKey(verse), true])) as VerseIds

export const parseVerseLocation = (verseKey: string): VerseLocation | null => {
  const [book, chapter, verse] = verseKey.split('-').map(Number)

  if (!Number.isFinite(book) || !Number.isFinite(chapter) || !Number.isFinite(verse)) {
    return null
  }

  return { book, chapter, verse }
}

export const getFirstSelectedVerseLocation = (selectedVerses: VerseIds): VerseLocation | null => {
  const firstVerseKey = Object.keys(selectedVerses)[0]
  if (!firstVerseKey) return null

  return parseVerseLocation(firstVerseKey)
}

export const selectedVersesIncludeFocus = (
  selectedVerses: VerseIds,
  focusVerses: (string | number)[] | undefined
): boolean => {
  if (!focusVerses?.length) return false

  const selectedKeys = Object.keys(selectedVerses)
  return focusVerses.some(focusVerse =>
    selectedKeys.some(selectedKey => selectedKey.endsWith(`-${focusVerse}`))
  )
}
