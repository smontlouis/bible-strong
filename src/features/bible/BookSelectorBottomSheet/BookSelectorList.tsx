import React, { useCallback, useEffect, useMemo } from 'react'
import { FlatList, ScrollView } from 'react-native'
import { bookSelectorSelectionModeAtom, bookSelectorSortAtom } from './atom'
import { useAtomValue } from 'jotai/react'
import books, { Book } from '~assets/bible_versions/books-desc'
import BookItem, { itemHeight } from './BookItem'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SharedValue } from 'react-native-reanimated'
import { BibleTab } from 'src/state/tabs'
import { BookShortItem } from './BookShortItem'

interface BookSelectorListProps {
  initialScrollIndex: number
  expandedBook: SharedValue<number | null>
  data: Book[]
  bookSelectorData?: BibleTab['data']
  flatListRef: React.RefObject<FlatList>
}
export const BookSelectorList = ({
  data,
  initialScrollIndex,
  expandedBook,
  bookSelectorData,
  flatListRef,
}: BookSelectorListProps) => {
  const insets = useSafeAreaInsets()
  const selectionMode = useAtomValue(bookSelectorSelectionModeAtom)

  const handleBookSelect = (book: Book) => {
    expandedBook.set(expandedBook.get() === book.Numero ? null : book.Numero)
  }

  const renderItem = ({ item: book }: { item: Book }) => (
    <BookItem
      book={book}
      isSelected={book.Numero === bookSelectorData?.selectedBook.Numero}
      onBookSelect={handleBookSelect}
      expandedBook={expandedBook}
    />
  )

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: initialScrollIndex,
        viewOffset: itemHeight * 2,
        animated: false,
      })
    }, 100)
  }, [initialScrollIndex])

  if (selectionMode === 'grid') {
    return (
      <ScrollView
        contentContainerStyle={{
          flexWrap: 'wrap',
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          paddingTop: 10,
          paddingBottom: insets.bottom,
        }}
      >
        {Object.values(books).map(book => (
          <BookShortItem
            isNT={book.Numero >= 40}
            key={book.Numero}
            onChange={() => {}}
            book={book}
            isSelected={book.Numero === bookSelectorData?.selectedBook.Numero}
          />
        ))}
      </ScrollView>
    )
  }

  return (
    <FlatList
      ref={flatListRef}
      data={data}
      renderItem={renderItem}
      getItemLayout={(_, index) => ({
        length: itemHeight,
        offset: itemHeight * index,
        index,
      })}
      onScrollToIndexFailed={error => console.log('[Bible] Scroll failed:', error)}
      keyExtractor={item => item.Numero.toString()}
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
      }}
      contentContainerStyle={{
        paddingBottom: insets.bottom,
      }}
    />
  )
}
