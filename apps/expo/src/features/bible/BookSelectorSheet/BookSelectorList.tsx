import React, { useEffect, useRef, useState } from 'react'
import { FlatList, ScrollView } from 'react-native'
import { bookSelectorSelectionModeAtom } from './atom'
import { useAtomValue } from 'jotai/react'
import { Book } from '~assets/bible_versions/books-desc'
import Box from '~common/ui/Box'
import { getReadingBookName } from '~helpers/readingLanguage'
import BookItem from './BookItem'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SharedValue } from 'react-native-reanimated'
import { BibleTab } from 'src/state/tabs'
import { BookShortItem } from './BookShortItem'
import ChapterGrid from './ChapterGrid'
import { getBookListRows, type BookListRow, type TestamentGroup } from './bookListRows'
import TestamentTitle from './TestamentTitle'

export interface BookListMetrics {
  scrollOffset: number
  viewportHeight: number
}

interface BookSelectorListProps {
  initialScrollOffset: number
  expandedBook: SharedValue<number | null>
  /** The books by testament, as `getTestamentGroups` sorts them. */
  groups: TestamentGroup[]
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
  groups,
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
  const rows = getBookListRows(groups)

  const renderItem = ({ item: row }: { item: BookListRow }) => {
    if (row.type === 'testament') return <TestamentTitle testament={row.testament} />

    const { book } = row
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
    if (rows.length === 0) return
    const scrollTimer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: initialScrollOffset,
        animated: false,
      })
    }, 100)

    return () => clearTimeout(scrollTimer)
  }, [rows.length, flatListRef, initialScrollOffset, listMetrics, mountScrollOffset])

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
          // A title brings its own top margin
          paddingTop: groups[0]?.testament ? 0 : 10,
          paddingBottom: insets.bottom,
        }}
      >
        {groups.map(group => (
          <Box key={group.testament ?? 'all'}>
            {group.testament ? <TestamentTitle testament={group.testament} /> : null}
            <Box className="flex-row flex-wrap items-start">
              {group.books.map(book => (
                <BookShortItem
                  key={book.Numero}
                  onChange={onGridBookSelect}
                  book={book}
                  bookName={getReadingBookName(book, bookSelectorData?.selectedVersion)}
                  isSelected={book.Numero === bookSelectorData?.selectedBook.Numero}
                />
              ))}
            </Box>
          </Box>
        ))}
      </ScrollView>
    )
  }

  return (
    <FlatList
      ref={flatListRef}
      data={rows}
      renderItem={renderItem}
      keyExtractor={row => (row.type === 'book' ? row.book.Numero.toString() : row.testament)}
      // Each testament's title stays over its books, as the version list keeps its groups' titles
      stickyHeaderIndices={rows.flatMap((row, index) => (row.type === 'testament' ? [index] : []))}
      contentOffset={{ x: 0, y: mountScrollOffset }}
      // Every row is rendered at once, so the offset lands on laid out rows
      initialNumToRender={rows.length}
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
