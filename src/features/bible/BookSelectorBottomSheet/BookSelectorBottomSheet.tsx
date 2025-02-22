import BottomSheet from '@gorhom/bottom-sheet'
import { Portal } from '@gorhom/portal'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'

import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, FlatList } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BibleTab, BibleTabActions } from 'src/state/tabs'
import books, { Book } from '~assets/bible_versions/books-desc'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { HelpTip } from '~features/tips/HelpTip'
import {
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'
import { bookSelectorSortAtom, bookSelectorVersesAtom } from './atom'
import BookItem, { itemHeight } from './BookItem'
import { BookSelectorParams } from './BookSelectorParams'
import VerseBottomSheet from './VerseBottomSheet'

export type SelectionEvent = {
  type: 'select' | 'longPress'
  book: Book
  chapter: number
}

// Définir une constante pour l'event name pour éviter les typos
export const BOOK_SELECTION_EVENT = 'book-selection'
interface BookSelectorBottomSheetProps {
  selectedBookNum?: number
  bottomSheetRef: React.RefObject<BottomSheet>
}

export const bookSelectorDataAtom = atom<{
  actions?: BibleTabActions
  data?: BibleTab['data']
}>({})

const BookSelectorBottomSheet = ({
  bottomSheetRef,
}: BookSelectorBottomSheetProps) => {
  const insets = useSafeAreaInsets()
  const expandedBook = useSharedValue<number | null>(null)
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const flatListRef = useRef<FlatList>(null)
  const { t } = useTranslation()
  const sort = useAtomValue(bookSelectorSortAtom)
  const isAlphabetical = sort === 'alphabetical'
  const verses = useAtomValue(bookSelectorVersesAtom)
  const bookSelectorHasVerses = verses === 'with-verses'

  const { actions: bookSelectorActions, data: bookSelectorData } = useAtomValue(
    bookSelectorDataAtom
  )
  const openInNewTab = useOpenInNewTab()
  const verseBottomSheetRef = useRef<BottomSheet>(null)

  const handleBookSelect = (book: Book) => {
    expandedBook.value = expandedBook.value === book.Numero ? null : book.Numero
  }

  // On écoute les événements de sélection
  useEffect(() => {
    const handleSelection = (event: SelectionEvent) => {
      const { type, book, chapter } = event
      if (!bookSelectorActions || !bookSelectorData) {
        return
      }

      if (type === 'select') {
        if (bookSelectorHasVerses) {
          bookSelectorActions.setTempSelectedBook(book)
          bookSelectorActions.setTempSelectedChapter(chapter)
          verseBottomSheetRef.current?.expand()
          return
        }
        bookSelectorActions.setTempSelectedBook(book)
        bookSelectorActions.setTempSelectedChapter(chapter)
        bookSelectorActions.setTempSelectedVerse(1)
        bookSelectorActions.validateTempSelected()
        bottomSheetRef.current?.close()
      } else if (type === 'longPress') {
        if (bookSelectorHasVerses) {
          return
        }
        bottomSheetRef.current?.close()
        setTimeout(() => {
          openInNewTab(
            {
              id: `bible-${Date.now()}`,
              title: t('tabs.new'),
              isRemovable: true,
              type: 'bible',
              data: {
                ...bookSelectorData,
                selectionMode: bookSelectorData?.selectionMode || 'list',
                selectedBook: book,
                selectedChapter: chapter,
                selectedVerse: 1,
              },
            },
            { autoRedirect: true }
          )
        }, 200)
      }
    }
    //
    const subscription = DeviceEventEmitter.addListener(
      BOOK_SELECTION_EVENT,
      handleSelection
    )
    //
    return () => {
      subscription.remove()
    }
  }, [
    bookSelectorActions,
    openInNewTab,
    t,
    bookSelectorData,
    bookSelectorHasVerses,
  ])

  const renderItem = useCallback(
    ({ item: book }: { item: Book }) => (
      <BookItem
        book={book}
        isSelected={book.Numero === bookSelectorData?.selectedBook.Numero}
        onBookSelect={handleBookSelect}
        expandedBook={expandedBook}
      />
    ),
    [bookSelectorData?.selectedBook.Numero]
  )

  const data = useMemo(() => {
    const booksArray = Object.values(books)
    if (isAlphabetical) {
      return [...booksArray].sort((a, b) => a.Nom.localeCompare(b.Nom))
    }
    return booksArray
  }, [isAlphabetical])

  const initialScrollIndex = data.findIndex(
    book => book.Numero === (bookSelectorData?.selectedBook.Numero || 1)
  )

  useEffect(() => {
    console.log('initialScrollIndex: ', initialScrollIndex)
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: initialScrollIndex,
        viewOffset: itemHeight * 2,
        animated: false,
      })
    }, 100)
  }, [initialScrollIndex])

  console.log('bookSelectorBottomSheet')

  return (
    <>
      <Portal>
        <BottomSheet
          key={key}
          ref={bottomSheetRef}
          snapPoints={['100%']}
          index={-1}
          topInset={insets.top + 64}
          enablePanDownToClose
          enableDynamicSizing={false}
          enableContentPanningGesture={false}
          backdropComponent={renderBackdrop}
          onAnimate={(fromIndex, toIndex) => {
            if (fromIndex === -1 && toIndex === 0) {
              flatListRef.current?.scrollToIndex({
                index: initialScrollIndex,
                viewOffset: itemHeight * 2,
                animated: false,
              })
            }
            if (fromIndex === 0 && toIndex === -1) {
              expandedBook.value = null
            }
          }}
          {...bottomSheetStyles}
        >
          <HStack
            height={54}
            justifyContent="center"
            alignItems="center"
            borderBottomWidth={1}
            borderColor="lightGrey"
          >
            <Box px={20} width={100}></Box>
            <Text flex textAlign="center" fontSize={16} bold>
              {t('Livres')}
            </Text>
            <BookSelectorParams />
          </HStack>
          <HelpTip
            id="chapter-selector"
            description={t('tips.chapterSelector')}
          />
          <FlatList
            ref={flatListRef}
            data={data}
            renderItem={renderItem}
            getItemLayout={(_, index) => ({
              length: itemHeight,
              offset: itemHeight * index,
              index,
            })}
            onScrollToIndexFailed={error => console.log('scroll failed', error)}
            keyExtractor={item => item.Numero.toString()}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
            contentContainerStyle={{
              paddingBottom: insets.bottom,
            }}
          />
        </BottomSheet>
        <VerseBottomSheet
          bottomSheetRef={verseBottomSheetRef}
          bookSelectorRef={bottomSheetRef}
        />
      </Portal>
    </>
  )
}

export default BookSelectorBottomSheet
