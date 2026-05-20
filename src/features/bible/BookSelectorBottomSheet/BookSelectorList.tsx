import React, { useEffect } from 'react'
import { FlatList, ScrollView } from 'react-native'
import { bookSelectorSelectionModeAtom } from './atom'
import { useAtomValue } from 'jotai/react'
import { Book } from '~assets/bible_versions/books-desc'
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
  flatListRef: React.RefObject<FlatList | null>
  chaptersByBook?: Record<number, number[]>
}
export const BookSelectorList = ({
  data,
  initialScrollIndex,
  expandedBook,
  bookSelectorData,
  flatListRef,
  chaptersByBook,
}: BookSelectorListProps) => {
  const insets = useSafeAreaInsets()
  const selectionMode = useAtomValue(bookSelectorSelectionModeAtom)

  const handleBookSelect = (book: Book) => {
    expandedBook.set(expandedBook.get() === book.Numero ? null : book.Numero)
  }

  const renderItem = ({ item: book }: { item: Book }) => (
    <BookItem
      book={book}
      chapters={chaptersByBook?.[book.Numero]}
      isSelected={book.Numero === bookSelectorData?.selectedBook.Numero}
      onBookSelect={handleBookSelect}
      expandedBook={expandedBook}
    />
  )

  useEffect(() => {
    if (data.length === 0) return
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: initialScrollIndex,
        viewOffset: itemHeight * 2,
        animated: false,
      })
    }, 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length, initialScrollIndex])

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
        {data.map(book => (
          <BookShortItem
            isNT={book.Numero >= 40}
            key={book.Numero}
            onChange={() => {}}
            book={book}
            chapters={chaptersByBook?.[book.Numero]}
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
