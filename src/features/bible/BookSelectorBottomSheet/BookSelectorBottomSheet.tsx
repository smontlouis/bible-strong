import { BottomSheetModal } from '@gorhom/bottom-sheet'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { useAtomValue, useSetAtom } from 'jotai/react'
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
import generateUUID from '~helpers/generateUUID'
import { HelpTip } from '~features/tips/HelpTip'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { ContainerComponent } from '~common/Modal'
import { bookSelectorSortAtom, bookSelectorVersesAtom } from './atom'
import { itemHeight } from './BookItem'
import { BookSelectorList } from './BookSelectorList'
import { BookSelectorParams } from './BookSelectorParams'
import { BOOK_SELECTION_EVENT, SelectionEvent } from './constants'
import VerseBottomSheet, { tempSelectedBookAtom, tempSelectedChapterAtom } from './VerseBottomSheet'
import { useQuery } from '~helpers/react-query-lite'
import { getBibleVersionCoverage } from '~helpers/biblesDb'
interface BookSelectorBottomSheetProps {
  selectedBookNum?: number
  bottomSheetRef: React.RefObject<BottomSheetModal | null>
}

export const bookSelectorDataAtom = atom<{
  actions?: BibleTabActions
  data?: BibleTab['data']
}>({})

const BookSelectorBottomSheet = ({ bottomSheetRef }: BookSelectorBottomSheetProps) => {
  const insets = useSafeAreaInsets()
  const expandedBook = useSharedValue<number | null>(null)
  const [expandedBookNumber, setExpandedBookNumber] = useState<number | null>(null)
  const [renderedChapterBookNumbers, setRenderedChapterBookNumbers] = useState<number[]>([])
  const collapseTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
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
  const verseBottomSheetRef = useRef<BottomSheetModal>(null)
  const selectedVersion = bookSelectorData?.selectedVersion

  const { data: coverageData } = useQuery({
    queryKey: ['bible-version-coverage', selectedVersion || ''],
    queryFn: () => getBibleVersionCoverage(selectedVersion || 'LSG'),
    enabled: !!selectedVersion,
  })

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
          verseBottomSheetRef.current?.present()
          return
        }
        bookSelectorActions.setTempSelectedBook(book)
        bookSelectorActions.setTempSelectedChapter(chapter)
        bookSelectorActions.setTempSelectedVerse(1)
        bookSelectorActions.validateTempSelected()
        bottomSheetRef.current?.dismiss()
      } else if (type === 'longPress') {
        if (bookSelectorHasVerses) {
          return
        }
        bottomSheetRef.current?.dismiss()
        setTimeout(() => {
          openInNewTab(
            {
              id: `bible-${generateUUID()}`,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookSelectorActions, openInNewTab, t, bookSelectorData, bookSelectorHasVerses])

  const data = useMemo(() => {
    const booksArray = Object.values(books).filter(book => {
      if (!coverageData?.books?.length) return true
      return coverageData.books.includes(book.Numero)
    })
    if (isAlphabetical) {
      return [...booksArray].sort((a, b) => a.Nom.localeCompare(b.Nom))
    }
    return booksArray
  }, [coverageData?.books, isAlphabetical])

  const initialScrollIndex = data.findIndex(
    book => book.Numero === (bookSelectorData?.selectedBook.Numero || 1)
  )
  const safeInitialScrollIndex = Math.max(initialScrollIndex, 0)

  useEffect(
    () => () => {
      Object.values(collapseTimeouts.current).forEach(clearTimeout)
    },
    []
  )

  const scheduleChapterUnmount = (bookNumber: number) => {
    clearTimeout(collapseTimeouts.current[bookNumber])
    collapseTimeouts.current[bookNumber] = setTimeout(() => {
      setRenderedChapterBookNumbers(current => current.filter(value => value !== bookNumber))
      delete collapseTimeouts.current[bookNumber]
    }, 300)
  }

  const handleBookSelect = (book: Book) => {
    const currentExpandedBookNumber = expandedBookNumber

    if (currentExpandedBookNumber === book.Numero) {
      expandedBook.set(null)
      setExpandedBookNumber(null)
      scheduleChapterUnmount(book.Numero)
      return
    }

    if (currentExpandedBookNumber !== null) {
      scheduleChapterUnmount(currentExpandedBookNumber)
    }

    clearTimeout(collapseTimeouts.current[book.Numero])
    delete collapseTimeouts.current[book.Numero]
    setRenderedChapterBookNumbers(current =>
      current.includes(book.Numero) ? current : [...current, book.Numero]
    )
    expandedBook.set(book.Numero)
    setExpandedBookNumber(book.Numero)
  }

  return (
    <>
      <BottomSheetModal
        key={key}
        ref={bottomSheetRef}
        snapPoints={['100%']}
        topInset={insets.top + 64}
        enablePanDownToClose
        enableDynamicSizing={false}
        enableContentPanningGesture={false}
        backdropComponent={renderBackdrop}
        containerComponent={ContainerComponent}
        activeOffsetY={[-20, 20]}
        onAnimate={(fromIndex, toIndex) => {
          // Opening the bottom sheet
          if (fromIndex === -1 && toIndex === 0 && data.length > 0) {
            flatListRef.current?.scrollToIndex({
              index: safeInitialScrollIndex,
              viewOffset: itemHeight * 2,
              animated: false,
            })
          }
          // Closing the bottom sheet
          if (fromIndex === 0 && toIndex === -1) {
            expandedBook.set(null)
            setExpandedBookNumber(null)
            Object.values(collapseTimeouts.current).forEach(clearTimeout)
            collapseTimeouts.current = {}
            setRenderedChapterBookNumbers([])
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
          key={selectedVersion}
          data={data}
          initialScrollIndex={safeInitialScrollIndex}
          expandedBook={expandedBook}
          bookSelectorData={bookSelectorData}
          flatListRef={flatListRef}
          chaptersByBook={coverageData?.chaptersByBook}
          renderedChapterBookNumbers={renderedChapterBookNumbers}
          onBookSelect={handleBookSelect}
        />
      </BottomSheetModal>
      <VerseBottomSheet
        bottomSheetRef={verseBottomSheetRef}
        bookSelectorRef={bottomSheetRef}
        actions={bookSelectorActions}
        data={bookSelectorData}
      />
    </>
  )
}

export default BookSelectorBottomSheet
