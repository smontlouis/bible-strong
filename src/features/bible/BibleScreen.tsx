import produce from 'immer'
import { useMemo } from 'react'

import books, { Book } from '~assets/bible_versions/books-desc'

import { StackScreenProps } from '@react-navigation/stack'
import { atom } from 'jotai/vanilla'
import { isEmpty } from '~helpers/deep-obj/utils'
import { MainStackProps } from '~navigation/type'
import {
  BibleTab,
  defaultBibleAtom,
  getDefaultBibleTab,
} from '../../state/tabs'
import BibleTabScreen from './BibleTabScreen'

const BibleScreen = ({
  navigation,
  route,
}: StackScreenProps<MainStackProps, 'BibleView'>) => {
  const {
    focusVerses,
    isSelectionMode,
    isReadOnly,
    book,
    chapter,
    verse,
    version,
  } = route.params

  const initialValues = produce(getDefaultBibleTab(), draft => {
    draft.id = `bible-${Date.now()}`
    if (book)
      draft.data.selectedBook = Number.isInteger(book)
        ? books[(book as number) - 1]
        : (book as Book)

    if (chapter) draft.data.selectedChapter = chapter
    if (verse) draft.data.selectedVerse = verse
    if (version) draft.data.selectedVersion = version
    if (focusVerses) draft.data.focusVerses = focusVerses
    if (isSelectionMode) draft.data.isSelectionMode = isSelectionMode
    if (isReadOnly) draft.data.isReadOnly = isReadOnly
  })

  const onTheFlyAtom = useMemo(() => atom<BibleTab>(initialValues), [])

  const bibleAtom = isEmpty(route.params) ? defaultBibleAtom : onTheFlyAtom

  return <BibleTabScreen bibleAtom={bibleAtom} navigation={navigation} />
}

export default BibleScreen
