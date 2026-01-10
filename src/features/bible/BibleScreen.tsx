import produce from 'immer'
import { useMemo } from 'react'

import books, { Book } from '~assets/bible_versions/books-desc'

import { useLocalSearchParams } from 'expo-router'
import { atom } from 'jotai/vanilla'
import { BibleTab, getDefaultBibleTab } from '../../state/tabs'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import BibleTabScreen from './BibleTabScreen'

const BibleScreen = () => {
  const params = useLocalSearchParams<{
    focusVerses?: string
    isSelectionMode?: string
    isReadOnly?: string
    book?: string
    chapter?: string
    verse?: string
    version?: string
  }>()

  // Parse params from URL strings
  const focusVerses = params.focusVerses ? JSON.parse(params.focusVerses) : undefined
  const isSelectionMode = params.isSelectionMode || undefined
  const isReadOnly = params.isReadOnly === 'true'
  const book = params.book ? JSON.parse(params.book) : undefined
  const chapter = params.chapter ? Number(params.chapter) : undefined
  const verse = params.verse ? Number(params.verse) : undefined
  const version = params.version || undefined

  const defaultVersion = useDefaultBibleVersion()

  const initialValues = produce(getDefaultBibleTab(version || defaultVersion), draft => {
    draft.id = `bible-${Date.now()}`
    if (book)
      draft.data.selectedBook = Number.isInteger(book)
        ? books[(book as number) - 1]
        : (book as Book)

    if (chapter) draft.data.selectedChapter = chapter
    if (verse) draft.data.selectedVerse = verse
    if (focusVerses) draft.data.focusVerses = focusVerses
    if (isSelectionMode) draft.data.isSelectionMode = isSelectionMode
    if (isReadOnly) draft.data.isReadOnly = isReadOnly
  })

  // Always create an on-the-fly atom for this screen
  const bibleAtom = useMemo(() => atom<BibleTab>(initialValues), [])

  return <BibleTabScreen bibleAtom={bibleAtom} withNavigation />
}

export default BibleScreen
