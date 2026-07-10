import type { Book } from '~assets/bible_versions/books-desc'
import type { BibleTabActions } from 'src/state/tabs'

type ChapterSelectionActions = Pick<
  BibleTabActions,
  'setTempSelectedBook' | 'setTempSelectedChapter' | 'setTempSelectedVerse' | 'validateTempSelected'
>

interface ChapterSelection {
  book: Book
  chapter: number
}

interface ChapterSelectionDependencies {
  actions: ChapterSelectionActions
  hasVerses: boolean
  dismissBookSelector: () => void
  presentVerseSelector: () => void
  setVerseSelectorBook: (book: Book) => void
  setVerseSelectorChapter: (chapter: number) => void
}

export const applyBookChapterSelection = (
  { book, chapter }: ChapterSelection,
  {
    actions,
    hasVerses,
    dismissBookSelector,
    presentVerseSelector,
    setVerseSelectorBook,
    setVerseSelectorChapter,
  }: ChapterSelectionDependencies
) => {
  if (hasVerses) {
    setVerseSelectorBook(book)
    setVerseSelectorChapter(chapter)
    actions.setTempSelectedBook(book)
    actions.setTempSelectedChapter(chapter)
    presentVerseSelector()
    return
  }

  actions.setTempSelectedBook(book)
  actions.setTempSelectedChapter(chapter)
  actions.setTempSelectedVerse(1)
  actions.validateTempSelected()
  dismissBookSelector()
}
