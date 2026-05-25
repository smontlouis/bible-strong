import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import {
  makeLinksByChapterSelector,
  makeStudyRelationsByChapterSelector,
  makeNotesForVerseSelector,
  makeHasTaggedItemsForVerseSelector,
} from '~redux/selectors/bible'
import { makeSelectBookmarkForVerse } from '~redux/selectors/bookmarks'
import type { VerseIds } from '~common/types'
import type { VerseActiveStates } from '../types'
import { createVerseEndpoint } from '~redux/modules/user'
import { endpointIdentity } from '~features/studyRelations/domain'

interface UseVerseActiveStatesParams {
  selectedVerses: VerseIds
  focusVerses?: (string | number)[]
}

const useVerseActiveStates = ({
  selectedVerses,
  focusVerses,
}: UseVerseActiveStatesParams): VerseActiveStates => {
  // Create memoized selectors for detecting active states
  const selectNotesForVerse = useMemo(() => makeNotesForVerseSelector(), [])
  const selectHasTaggedItems = useMemo(() => makeHasTaggedItemsForVerseSelector(), [])
  const selectLinksByChapter = useMemo(() => makeLinksByChapterSelector(), [])
  const selectStudyRelationsByChapter = useMemo(() => makeStudyRelationsByChapterSelector(), [])
  const selectBookmarkForVerse = useMemo(() => makeSelectBookmarkForVerse(), [])

  // Get the first selected verse for checking active states
  const firstVerseKey = Object.keys(selectedVerses)[0]
  const [bookStr, chapterStr, verseStr] = firstVerseKey?.split('-') || []
  const book = bookStr ? parseInt(bookStr) : 0
  const chapter = chapterStr ? parseInt(chapterStr) : 0
  const verse = verseStr ? parseInt(verseStr) : 0

  // Check if the selected verse has a note
  const hasNote = useSelector((state: RootState) => {
    if (!firstVerseKey) return false
    const notes = selectNotesForVerse(state, firstVerseKey)
    return notes.length > 0
  })

  // Check if the selected verse has tags
  const hasTags = useSelector((state: RootState) => {
    if (!firstVerseKey) return false
    return selectHasTaggedItems(state, firstVerseKey)
  })

  // Check if the selected verse has a link
  const hasLink = useSelector((state: RootState) => {
    if (!firstVerseKey || !book || !chapter) return false
    const links = selectLinksByChapter(state, book, chapter)
    return Object.keys(links).some(key => key.split('#')[0].split('/').includes(firstVerseKey))
  })

  const hasStudyRelation = useSelector((state: RootState) => {
    if (!firstVerseKey || !book || !chapter) return false
    const relations = selectStudyRelationsByChapter(state, book, chapter)
    const selectedEndpointIdentity = endpointIdentity(
      createVerseEndpoint(Object.keys(selectedVerses))
    )

    return Object.values(relations).some(relation =>
      relation.endpoints.some(
        endpoint =>
          endpoint.type === 'verse' && endpointIdentity(endpoint) === selectedEndpointIdentity
      )
    )
  })

  // Check if the selected verse has a bookmark
  const hasBookmark = useSelector((state: RootState) => {
    if (!book || !chapter || !verse) return false
    return !!selectBookmarkForVerse(state, book, chapter, verse)
  })

  // Check if focus mode is active for selected verses
  const hasFocus =
    focusVerses?.some(v => Object.keys(selectedVerses).some(key => key.endsWith(`-${v}`))) ?? false

  return {
    hasNote,
    hasTags,
    hasLink,
    hasStudyRelation,
    hasBookmark,
    hasFocus,
  }
}

export default useVerseActiveStates
