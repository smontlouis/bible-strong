import type { VerseIds } from '~common/types'

export type BibleReaderShortcutsProps = {
  tabId: string
  /** The version the selection is made in. */
  version: string
  selectedVerses: VerseIds
  canChangeChapter: boolean
  canSelect: boolean
  onPreviousChapter: () => void
  onNextChapter: () => void
  onSelect: (verses: VerseIds) => void
}

/** The reader's keys only exist on the web. */
export default function BibleReaderShortcuts(_: BibleReaderShortcutsProps) {
  return null
}
