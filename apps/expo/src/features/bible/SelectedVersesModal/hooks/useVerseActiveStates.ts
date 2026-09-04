import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import { makeSelectBookmarkForVerse } from '~redux/selectors/bookmarks'
import type { VerseIds } from '~common/types'
import type { VerseActiveStates } from '../types'

interface UseVerseActiveStatesParams {
  selectedVerses: VerseIds
  focusVerses?: (string | number)[]
}

const useVerseActiveStates = ({
  selectedVerses,
  focusVerses,
}: UseVerseActiveStatesParams): VerseActiveStates => {
  // Create memoized selectors for detecting active states
  const selectBookmarkForVerse = useMemo(() => makeSelectBookmarkForVerse(), [])

  // Get the first selected verse for checking active states
  const firstVerseKey = Object.keys(selectedVerses)[0]
  const [bookStr, chapterStr, verseStr] = firstVerseKey?.split('-') || []
  const book = bookStr ? parseInt(bookStr) : 0
  const chapter = chapterStr ? parseInt(chapterStr) : 0
  const verse = verseStr ? parseInt(verseStr) : 0

  // Check if the selected verse has a bookmark
  const hasBookmark = useSelector((state: RootState) => {
    if (!book || !chapter || !verse) return false
    return !!selectBookmarkForVerse(state, book, chapter, verse)
  })

  // Check if focus mode is active for selected verses
  const selectedKeys = Object.keys(selectedVerses)
  const selectedPrefix = book && chapter ? `${book}-${chapter}-` : ''
  const hasFocus =
    focusVerses?.some(focusVerse =>
      selectedKeys.some(selectedKey => selectedKey === `${selectedPrefix}${focusVerse}`)
    ) ?? false

  return {
    hasBookmark,
    hasFocus,
  }
}

export default useVerseActiveStates
