import React, { useEffect, useRef, useState } from 'react'
import { FlatList, ScrollView } from 'react-native'
import { bookSelectorSelectionModeAtom } from './atom'
import { useAtomValue } from 'jotai/react'
import { Book } from '~assets/bible_versions/books-desc'
import { getReadingBookName } from '~helpers/readingLanguage'
import BookItem from './BookItem'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SharedValue } from 'react-native-reanimated'
import { BibleTab } from 'src/state/tabs'
import { BookShortItem } from './BookShortItem'
import ChapterGrid from './ChapterGrid'
import { getBookCorpus } from '~helpers/bibleBookCatalog'

export interface BookListMetrics {
  scrollOffset: number
  viewportHeight: number
}

interface BookSelectorListProps {
  initialScrollOffset: number
  expandedBook: SharedValue<number | null>
  data: Book[]
  bookSelectorData?: BibleTab['data']
  flatListRef: React.RefObject<FlatList | null>
  listMetrics: React.RefObject<BookListMetrics>
  chaptersByBook?: Record<number, number[]>
  renderedChapterBookNumbers: number[]
  instantBookNumber: number | null
  onBookSelect: (book: Book) => void
  gridBook: Book | null
  onGridBookSelect: (book: Book) => void
}
export const BookSelectorList = ({
  data,
  initialScrollOffset,
  expandedBook,
  bookSelectorData,
  flatListRef,
  listMetrics,
  chaptersByBook,
  renderedChapterBookNumbers,
  instantBookNumber,
  onBookSelect,
  gridBook,
  onGridBookSelect,
}: BookSelectorListProps) => {
  const insets = useSafeAreaInsets()
  const selectionMode = useAtomValue(bookSelectorSelectionModeAtom)

  const renderItem = ({ item: book }: { item: Book }) => {
    const isSelected = book.Numero === bookSelectorData?.selectedBook.Numero

    return (
      <BookItem
        book={book}
        bookName={getReadingBookName(book, bookSelectorData?.selectedVersion)}
        chapters={chaptersByBook?.[book.Numero]}
        isSelected={isSelected}
        selectedChapter={isSelected ? bookSelectorData?.selectedChapter : undefined}
        onBookSelect={onBookSelect}
        expandedBook={expandedBook}
        shouldRenderChapters={renderedChapterBookNumbers.includes(book.Numero)}
        expandsInstantly={book.Numero === instantBookNumber}
      />
    )
  }

  // The list mounts with each opening and starts at this offset; later changes scroll to it
  const [mountScrollOffset] = useState(initialScrollOffset)
  const hasMountedRef = useRef(false)

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      listMetrics.current.scrollOffset = mountScrollOffset
      return
    }
    if (data.length === 0) return
    const scrollTimer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: initialScrollOffset,
        animated: false,
      })
    }, 100)

    return () => clearTimeout(scrollTimer)
  }, [data.length, flatListRef, initialScrollOffset, listMetrics, mountScrollOffset])

  if (selectionMode === 'grid') {
    if (gridBook) {
      return (
        <ChapterGrid
          book={gridBook}
          chapters={chaptersByBook?.[gridBook.Numero]}
          selectedChapter={
            gridBook.Numero === bookSelectorData?.selectedBook.Numero
              ? bookSelectorData.selectedChapter
              : undefined
          }
        />
      )
    }

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
            isNT={getBookCorpus(book.Numero) === 'new'}
            key={book.Numero}
            onChange={onGridBookSelect}
            book={book}
            bookName={getReadingBookName(book, bookSelectorData?.selectedVersion)}
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
      keyExtractor={item => item.Numero.toString()}
      contentOffset={{ x: 0, y: mountScrollOffset }}
      // Every book is rendered at once, so the offset lands on laid out rows
      initialNumToRender={data.length}
      onLayout={event => {
        listMetrics.current.viewportHeight = event.nativeEvent.layout.height
      }}
      onScroll={event => {
        listMetrics.current.scrollOffset = event.nativeEvent.contentOffset.y
      }}
      scrollEventThrottle={16}
      contentContainerStyle={{
        paddingBottom: insets.bottom,
      }}
    />
  )
}
