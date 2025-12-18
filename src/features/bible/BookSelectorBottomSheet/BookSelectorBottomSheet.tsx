import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { Portal } from '@gorhom/portal'
import React, { useEffect, useMemo, useRef } from 'react'

import { useAtomValue, useSetAtom } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, FlatList } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BibleTab, BibleTabActions } from 'src/state/tabs'
import books from '~assets/bible_versions/books-desc'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { HelpTip } from '~features/tips/HelpTip'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { bookSelectorSortAtom, bookSelectorVersesAtom } from './atom'
import { itemHeight } from './BookItem'
import { BookSelectorList } from './BookSelectorList'
import { BookSelectorParams } from './BookSelectorParams'
import { BOOK_SELECTION_EVENT, SelectionEvent } from './constants'
import VerseBottomSheet, { tempSelectedBookAtom, tempSelectedChapterAtom } from './VerseBottomSheet'
interface BookSelectorBottomSheetProps {
  selectedBookNum?: number
  bottomSheetRef: React.RefObject<BottomSheet>
}

export const bookSelectorDataAtom = atom<{
  actions?: BibleTabActions
  data?: BibleTab['data']
}>({})

const BookSelectorBottomSheet = ({ bottomSheetRef }: BookSelectorBottomSheetProps) => {
  const insets = useSafeAreaInsets()
  const expandedBook = useSharedValue<number | null>(null)
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const flatListRef = useRef<FlatList>(null)
  const { t } = useTranslation()
  const sort = useAtomValue(bookSelectorSortAtom)
  const isAlphabetical = sort === 'alphabetical'
  const verses = useAtomValue(bookSelectorVersesAtom)
  const bookSelectorHasVerses = verses === 'with-verses'
  const setTempSelectedBook = useSetAtom(tempSelectedBookAtom)
  const setTempSelectedChapter = useSetAtom(tempSelectedChapterAtom)
  const { actions: bookSelectorActions, data: bookSelectorData } =
    useAtomValue(bookSelectorDataAtom)
  const openInNewTab = useOpenInNewTab()
  const verseBottomSheetRef = useRef<BottomSheet>(null)

  // On écoute les événements de sélection
  useEffect(() => {
    const handleSelection = (event: SelectionEvent) => {
      const { type, book, chapter } = event
      if (!bookSelectorActions || !bookSelectorData) {
        return
      }

      if (type === 'select') {
        if (bookSelectorHasVerses) {
          setTempSelectedBook(book)
          setTempSelectedChapter(chapter)
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
    const subscription = DeviceEventEmitter.addListener(BOOK_SELECTION_EVENT, handleSelection)
    //
    return () => {
      subscription.remove()
    }
  }, [bookSelectorActions, openInNewTab, t, bookSelectorData, bookSelectorHasVerses])

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
            // Opening the bottom sheet
            if (fromIndex === -1 && toIndex === 0) {
              flatListRef.current?.scrollToIndex({
                index: initialScrollIndex,
                viewOffset: itemHeight * 2,
                animated: false,
              })
            }
            // Closing the bottom sheet
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
            <Box px={20} width={60}></Box>
            <Text flex textAlign="center" fontSize={16} bold>
              {t('Livres')}
            </Text>
            <BookSelectorParams />
          </HStack>
          <HelpTip id="chapter-selector" description={t('tips.chapterSelector')} />
          <BookSelectorList
            data={data}
            initialScrollIndex={initialScrollIndex}
            expandedBook={expandedBook}
            bookSelectorData={bookSelectorData}
            flatListRef={flatListRef}
          />
        </BottomSheet>
        <VerseBottomSheet
          bottomSheetRef={verseBottomSheetRef}
          bookSelectorRef={bottomSheetRef}
          actions={bookSelectorActions}
          data={bookSelectorData}
        />
      </Portal>
    </>
  )
}

export default BookSelectorBottomSheet
