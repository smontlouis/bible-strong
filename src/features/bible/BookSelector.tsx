import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { FlatList } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Book } from '~assets/bible_versions/books-desc'
import { BibleTab, useBibleTabActions } from '../../state/tabs'
import BookSelectorItem from './BookSelectorItem'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import { getBooksForCanon } from '~helpers/bibleBookCatalog'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'

interface BookSelectorScreenProps {
  bibleAtom: PrimitiveAtom<BibleTab>
  onNavigate: (index: number) => void
  coverage?: BibleVersionCoverage
}

const BookSelector = ({ bibleAtom, onNavigate, coverage }: BookSelectorScreenProps) => {
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)
  const insets = useSafeAreaInsets()
  const {
    data: { selectedBook, selectedVersion },
  } = bible
  const books = getBooksForCanon(getBibleVersionCanonId(selectedVersion), coverage?.books)

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
      data={books}
      renderItem={renderItem}
      keyExtractor={item => item.Numero.toString()}
      contentContainerStyle={{
        paddingBottom: insets.bottom,
      }}
    />
  )
}

export default BookSelector
