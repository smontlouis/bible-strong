import type { Verse, VerseIds } from '~common/types'
import { createVerseEndpoint, type RelationEndpoint } from '~features/studyRelations/domain'

export interface VerseLocation {
  book: number
  chapter: number
  verse: number
}

export type SelectedVersesFocusAction = 'clear-focus' | 'pin-selected'

export const getVerseKey = (verse: Pick<Verse, 'Livre' | 'Chapitre' | 'Verset'>): string =>
  `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`

export const getSelectedVerseKeys = (selectedVerses: VerseIds): string[] =>
  Object.keys(selectedVerses)

export const hasSelectedVerses = (selectedVerses: VerseIds): boolean =>
  getSelectedVerseKeys(selectedVerses).length > 0

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
  const firstVerseKey = getSelectedVerseKeys(selectedVerses)[0]
  if (!firstVerseKey) return null

  return parseVerseLocation(firstVerseKey)
}

export const selectedVersesIncludeFocus = (
  selectedVerses: VerseIds,
  focusVerses: (string | number)[] | undefined
): boolean => {
  if (!focusVerses?.length) return false

  const selectedKeys = getSelectedVerseKeys(selectedVerses)
  return focusVerses.some(focusVerse =>
    selectedKeys.some(selectedKey => selectedKey.endsWith(`-${focusVerse}`))
  )
}

export const getSelectedVersesFocusAction = (
  selectedVerses: VerseIds,
  focusVerses: (string | number)[] | undefined
): SelectedVersesFocusAction =>
  selectedVersesIncludeFocus(selectedVerses, focusVerses) ? 'clear-focus' : 'pin-selected'

export const getSelectedVersesLinkParams = (selectedVerses: VerseIds): { verseKeys: string } => ({
  verseKeys: getSelectedVerseKeys(selectedVerses).join(','),
})

export const getSelectedVersesStudyPayload = (selectedVerses: VerseIds): string[] =>
  getSelectedVerseKeys(selectedVerses)

export const getSelectedVersesRelationEndpoint = (
  selectedVerses: VerseIds
): RelationEndpoint | null => {
  const verseKeys = getSelectedVerseKeys(selectedVerses)
  if (!verseKeys.length) return null
  return createVerseEndpoint(verseKeys)
}

export const getSelectedVersesBookmarkLocation = getFirstSelectedVerseLocation
