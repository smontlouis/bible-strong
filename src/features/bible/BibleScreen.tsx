import { produce } from 'immer'
import { useMemo } from 'react'

import { Book } from '~assets/bible_versions/books-desc'
import { getBook } from '~helpers/bibleBookCatalog'
import generateUUID from '~helpers/generateUUID'

import { useLocalSearchParams } from 'expo-router'
import { atom } from 'jotai/vanilla'
import {
  BibleContextDisplayMode,
  BibleTab,
  getDefaultBibleTab,
  VersionCode,
} from '../../state/tabs'
import { StudyNavigateBibleType } from '~common/types'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import BibleTabScreen from './BibleTabScreen'
import { IS_FORM_SHEET } from '~helpers/constants'

const BibleScreen = () => {
  const params = useLocalSearchParams<{
    focusVerses?: string
    contextDisplayMode?: BibleContextDisplayMode
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
  const contextDisplayMode =
    params.contextDisplayMode || (params.isReadOnly === 'true' ? 'focused' : undefined)
  const book = params.book ? JSON.parse(params.book) : undefined
  const chapter = params.chapter ? Number(params.chapter) : undefined
  const verse = params.verse ? Number(params.verse) : undefined
  const version = params.version || undefined

  const defaultVersion = useDefaultBibleVersion()

  const initialValues = produce(
    getDefaultBibleTab((version || defaultVersion) as VersionCode),
    draft => {
      draft.id = `bible-${generateUUID()}`
      if (book)
        draft.data.selectedBook = Number.isInteger(book)
          ? getBook(book as number) || getBook(1)!
          : (book as Book)

      if (chapter) draft.data.selectedChapter = chapter
      if (verse) draft.data.selectedVerse = verse
      if (focusVerses) draft.data.focusVerses = focusVerses
      if (isSelectionMode) draft.data.isSelectionMode = isSelectionMode as StudyNavigateBibleType
      if (contextDisplayMode) {
        draft.data.contextDisplayMode = contextDisplayMode
      }
    }
  )

  // Always create an on-the-fly atom for this screen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bibleAtom = useMemo(() => atom<BibleTab>(initialValues), [])

  return <BibleTabScreen bibleAtom={bibleAtom} isFormSheet={IS_FORM_SHEET} isInTab={false} />
}

export default BibleScreen
