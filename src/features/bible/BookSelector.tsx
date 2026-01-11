import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import books, { Book } from '~assets/bible_versions/books-desc'
import { BibleTab, useBibleTabActions } from '../../state/tabs'
import BookSelectorItem from './BookSelectorItem'

interface BookSelectorScreenProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  onNavigate: (index: number) => void
}

const BookSelector = ({ bibleAtom, onNavigate }: BookSelectorScreenProps) => {
  const { t } = useTranslation()
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const insets = useSafeAreaInsets()
  const {
    data: { selectionMode, selectedBook },
  } = bible

  const onBookChange = (book: Book) => {
    onNavigate(1)
    actions.setTempSelectedBook(book)
  }

  const renderItem = ({ item: book }: { item: Book }) => (
    <BookSelectorItem
      book={book}
      isSelected={book.Numero === selectedBook.Numero}
      onBookSelect={onBookChange}
    />
  )

  return (
    <FlatList
      data={Object.values(books)}
      renderItem={renderItem}
      keyExtractor={item => item.Numero.toString()}
      contentContainerStyle={{
        paddingBottom: insets.bottom,
      }}
    />
  )
}

export default BookSelector
