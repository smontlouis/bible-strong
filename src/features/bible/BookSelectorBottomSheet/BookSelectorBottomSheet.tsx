import BottomSheet from '@gorhom/bottom-sheet'
import { Portal } from '@gorhom/portal'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DeviceEventEmitter, FlatList } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import books, { Book } from '~assets/bible_versions/books-desc'
import {
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'
import BookItem, { itemHeight } from './BookItem'
import { HelpTip } from '~features/tips/HelpTip'
import { useTranslation } from 'react-i18next'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { MaterialIcon } from '~common/ui/Icon'
import { BibleTab } from 'src/state/tabs'
import { BibleTabActions } from 'src/state/tabs'
import { atom } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'

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
  const [isAlphabetical, setIsAlphabetical] = useState(false)
  const { actions: bookSelectorActions, data: bookSelectorData } = useAtomValue(
    bookSelectorDataAtom
  )
  const openInNewTab = useOpenInNewTab()

  const handleBookSelect = (book: Book) => {
    expandedBook.value = expandedBook.value === book.Numero ? null : book.Numero
  }

  // On écoute les événements de sélection
  useEffect(() => {
    const handleSelection = (event: SelectionEvent) => {
      const { type, book, chapter } = event
      if (!bookSelectorActions || !bookSelectorData) return
      //
      if (type === 'select') {
        bookSelectorActions.setTempSelectedBook(book)
        bookSelectorActions.setTempSelectedChapter(chapter)
        bookSelectorActions.validateTempSelected()
        bottomSheetRef.current?.close()
      } else if (type === 'longPress') {
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
  }, [bookSelectorActions, openInNewTab, t, bookSelectorData])

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
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: initialScrollIndex,
        viewOffset: itemHeight * 2,
        animated: false,
      })
    }, 100)
  }, [initialScrollIndex])

  const handleSortToggle = () => {
    setIsAlphabetical(prev => !prev)
  }

  return (
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
          <TouchableBox
            px={20}
            width={100}
            alignItems="flex-end"
            onPress={handleSortToggle}
          >
            <MaterialIcon
              name="sort-by-alpha"
              size={22}
              style={{ opacity: isAlphabetical ? 1 : 0.5 }}
              color={isAlphabetical ? 'primary' : 'grey'}
            />
          </TouchableBox>
        </HStack>
        <HelpTip
          id="chapter-selector"
          description={t('tips.chapterSelector')}
        />
        <FlatList
          ref={flatListRef}
          data={data}
          renderItem={renderItem}
          initialScrollIndex={initialScrollIndex}
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
    </Portal>
  )
}

export default BookSelectorBottomSheet
