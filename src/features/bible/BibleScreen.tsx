import produce from 'immer'
import { useMemo } from 'react'

import books, { Book } from '~assets/bible_versions/books-desc'

import { StackScreenProps } from '@react-navigation/stack'
import { atom } from 'jotai/vanilla'
import { MainStackProps } from '~navigation/type'
import { BibleTab, getDefaultBibleTab } from '../../state/tabs'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import BibleTabScreen from './BibleTabScreen'

const BibleScreen = ({ navigation, route }: StackScreenProps<MainStackProps, 'BibleView'>) => {
  const { focusVerses, isSelectionMode, isReadOnly, book, chapter, verse, version } = route.params
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

  return <BibleTabScreen bibleAtom={bibleAtom} navigation={navigation} />
}

export default BibleScreen
