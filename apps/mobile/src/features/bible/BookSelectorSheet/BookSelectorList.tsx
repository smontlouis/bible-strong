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
import ChapterGrid from './ChapterGrid'
import { getBookCorpus } from '~helpers/bibleBookCatalog'

interface BookSelectorListProps {
  initialScrollIndex: number
  expandedBook: SharedValue<number | null>
  data: Book[]
  bookSelectorData?: BibleTab['data']
  flatListRef: React.RefObject<FlatList | null>
  chaptersByBook?: Record<number, number[]>
  renderedChapterBookNumbers: number[]
  onBookSelect: (book: Book) => void
  gridBook: Book | null
  onGridBookSelect: (book: Book) => void
}
export const BookSelectorList = ({
  data,
  initialScrollIndex,
  expandedBook,
  bookSelectorData,
  flatListRef,
  chaptersByBook,
  renderedChapterBookNumbers,
  onBookSelect,
  gridBook,
  onGridBookSelect,
}: BookSelectorListProps) => {
  const insets = useSafeAreaInsets()
  const selectionMode = useAtomValue(bookSelectorSelectionModeAtom)

  const renderItem = ({ item: book }: { item: Book }) => (
    <BookItem
      book={book}
      chapters={chaptersByBook?.[book.Numero]}
      isSelected={book.Numero === bookSelectorData?.selectedBook.Numero}
      onBookSelect={onBookSelect}
      expandedBook={expandedBook}
      shouldRenderChapters={renderedChapterBookNumbers.includes(book.Numero)}
    />
  )

  useEffect(() => {
    if (data.length === 0) return
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({
        offset: Math.max(0, itemHeight * (initialScrollIndex - 2)),
        animated: false,
      })
    }, 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length, initialScrollIndex])

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
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
      }}
      contentContainerStyle={{
        paddingBottom: insets.bottom,
      }}
    />
  )
}
