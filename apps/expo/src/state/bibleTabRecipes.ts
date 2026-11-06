import type { Book } from '~assets/bible_versions/books-desc'
import { resetParallelColumnTextModes } from '~helpers/bibleColumnTextModes'
import {
  getNextAvailableChapterLocation,
  getPreviousAvailableChapterLocation,
  resolveBibleCoverageCanonId,
} from '~helpers/bibleCoverage'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
import { getSelectedVersesVersion, setSelectedVersesVersion } from './bibleSelectionVersion'
import type { BibleContextDisplayMode, BibleTab, VersionCode } from './tabs'

/**
 * Recipes of a Bible tab: changes of its data that `useBibleTabActions` and the Reader intents
 * (ADR-0098) share. Each one changes an Immer draft of the data, or only reads it.
 */
type BibleTabData = BibleTab['data']

export type BibleChapterLocation = { book: Book; chapter: number }

export const getBibleContextDisplayMode = (data: {
  contextDisplayMode?: BibleContextDisplayMode
  isReadOnly?: boolean
}): BibleContextDisplayMode =>
  data.contextDisplayMode ?? (data.isReadOnly ? 'focused' : 'fullChapter')

/** The chapter before or after the one on screen, among those the version holds. */
export const getAdjacentChapter = (
  data: Pick<BibleTabData, 'selectedBook' | 'selectedChapter' | 'selectedVersion'>,
  direction: 'previous' | 'next',
  coverage?: BibleVersionCoverage
): BibleChapterLocation | undefined => {
  const canonId = resolveBibleCoverageCanonId(
    coverage,
    getBibleVersionCanonId(data.selectedVersion)
  )
  const getLocation =
    direction === 'next' ? getNextAvailableChapterLocation : getPreviousAvailableChapterLocation
  return getLocation(data.selectedBook, data.selectedChapter, coverage, canonId) ?? undefined
}

/** A chapter reached from the one before or after opens at its first verse, out of any focus. */
export const openAdjacentChapter = (
  data: BibleTabData,
  { book, chapter }: BibleChapterLocation
) => {
  data.selectedBook = book
  data.selectedChapter = chapter
  data.selectedVerse = 1
  data.focusVerses = undefined
  data.temp = {
    selectedBook: book,
    selectedChapter: chapter,
    selectedVerse: 1,
  }
}

/** A parallel column taking a new version starts without any text mode. */
export const setParallelColumnVersion = (
  data: BibleTabData,
  index: number,
  version: VersionCode
) => {
  resetParallelColumnTextModes(data, index, version)
  data.parallelVersions[index] = version
}

/** Without a version, the verse joins the selection in the version it is in. */
export const selectVerse = (data: BibleTabData, verseKey: string, version?: VersionCode) => {
  // A selection stays in one version: a verse of another version starts a new one.
  if (version && version !== getSelectedVersesVersion(data)) {
    data.selectedVerses = {}
    delete data.selectedVersesVersion
    setSelectedVersesVersion(data, version)
  }
  data.selectedVerses[verseKey] = true
}

export const unselectVerse = (data: BibleTabData, verseKey: string) => {
  delete data.selectedVerses[verseKey]
}

export const clearVerseSelection = (data: BibleTabData) => {
  data.selectedVerses = {}
  delete data.selectedVersesVersion
}
