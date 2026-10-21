import { Sheet, SheetHeader, type SheetRef } from '~common/sheet'
import React, { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, FlatList, useWindowDimensions } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Book } from '~assets/bible_versions/books-desc'
import Box from '~common/ui/Box'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { HelpTip } from '~features/tips/HelpTip'
import { bookSelectorSelectionModeAtom, bookSelectorSortAtom, bookSelectorVersesAtom } from './atom'
import { getBookListScrollOffset } from './bookSelectorScroll'
import { BookSelectorList } from './BookSelectorList'
import { BookSelectorParams } from './BookSelectorParams'
import { BOOK_SELECTION_EVENT, SelectionEvent } from './constants'
import VerseSheet, { tempSelectedBookAtom, tempSelectedChapterAtom } from './VerseSheet'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '~themes/ThemeProvider'
import { applyBookChapterSelection } from './bookSelectorSelection'
import { getBooksForCanon, isBibleCanonId } from '~helpers/bibleBookCatalog'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
import { getReadingBookName } from '~helpers/readingLanguage'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { staticResourceQueryOptions } from '~helpers/queryOptions'

import { bookSelectorDataAtom } from './state'
interface BookSelectorSheetProps {
  selectedBookNum?: number
  sheetRef: React.RefObject<SheetRef | null>
}
export { bookSelectorDataAtom } from './state'

// Room taken above the list by the sheet header and its help tip
const SHEET_HEADER_ALLOWANCE = 120

const BookSelectorSheet = ({ sheetRef }: BookSelectorSheetProps) => {
  const expandedBook = useSharedValue<number | null>(null)
  const [expandedBookNumber, setExpandedBookNumber] = useState<number | null>(null)
  const [renderedChapterBookNumbers, setRenderedChapterBookNumbers] = useState<number[]>([])
  const [gridBook, setGridBook] = useState<Book | null>(null)
  const collapseTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const flatListRef = useRef<FlatList>(null)
  const isPresentedRef = useRef(false)
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const sort = useAtomValue(bookSelectorSortAtom)
  const isAlphabetical = sort === 'alphabetical'
  const selectionMode = useAtomValue(bookSelectorSelectionModeAtom)
  const verses = useAtomValue(bookSelectorVersesAtom)
  const bookSelectorHasVerses = verses === 'with-verses'
  const setTempSelectedBook = useSetAtom(tempSelectedBookAtom)
  const setTempSelectedChapter = useSetAtom(tempSelectedChapterAtom)
  const bookSelectorState = useAtomValue(bookSelectorDataAtom)
  const {
    actions: bookSelectorActions,
    data: bookSelectorData,
    coverage: providedCoverage,
  } = bookSelectorState
  const openInNewTab = useOpenInNewTab()
  const verseSheetRef = useRef<SheetRef>(null)
  const selectedVersion = bookSelectorData?.selectedVersion
  const theme = useTheme()
  const resources = useResourceAccess()

  const { data: bibleCoverageData } = useQuery({
    queryKey: resourceQueryKeys.bibleCoverage(selectedVersion || 'LSG'),
    queryFn: () => resources.bibleContent.loadCoverage(selectedVersion || 'LSG'),
    enabled: !!selectedVersion && !providedCoverage,
    ...staticResourceQueryOptions,
  })
  const coverageData = providedCoverage ?? bibleCoverageData
  const publishedCanonId = coverageData?.canon?.id
  const canonId =
    publishedCanonId && isBibleCanonId(publishedCanonId)
      ? publishedCanonId
      : getBibleVersionCanonId(selectedVersion || '')

  // On écoute les événements de sélection
  useEffect(() => {
    let openInNewTabTimer: ReturnType<typeof setTimeout> | undefined

    const handleSelection = (event: SelectionEvent) => {
      const { type, book, chapter } = event
      if (!bookSelectorActions || !bookSelectorData) {
        return
      }

      if (type === 'select') {
        applyBookChapterSelection(
          { book, chapter },
          {
            actions: bookSelectorActions,
            hasVerses: bookSelectorHasVerses,
            dismissBookSelector: () => sheetRef.current?.dismiss(),
            presentVerseSelector: () => verseSheetRef.current?.present(),
            setVerseSelectorBook: setTempSelectedBook,
            setVerseSelectorChapter: setTempSelectedChapter,
          }
        )
      } else if (type === 'longPress') {
        if (bookSelectorHasVerses) {
          return
        }
        sheetRef.current?.dismiss()
        if (openInNewTabTimer) clearTimeout(openInNewTabTimer)
        openInNewTabTimer = setTimeout(() => {
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
      if (openInNewTabTimer) clearTimeout(openInNewTabTimer)
    }
  }, [
    bookSelectorActions,
    openInNewTab,
    t,
    bookSelectorData,
    bookSelectorHasVerses,
    sheetRef,
    setTempSelectedBook,
    setTempSelectedChapter,
  ])

  const data = useMemo(() => {
    const booksArray = getBooksForCanon(canonId, coverageData?.books)
    if (isAlphabetical) {
      // Sorted as the reader sees them, in the reading's language
      return [...booksArray].sort((a, b) =>
        getReadingBookName(a, selectedVersion).localeCompare(getReadingBookName(b, selectedVersion))
      )
    }
    return booksArray
  }, [canonId, coverageData?.books, isAlphabetical, selectedVersion])

  const selectedBookNumber = bookSelectorData?.selectedBook.Numero || 1
  const initialScrollIndex = data.findIndex(book => book.Numero === selectedBookNumber)
  const selectedBookChapters = coverageData?.chaptersByBook?.[selectedBookNumber]
  const selectedChapter = bookSelectorData?.selectedChapter ?? 1
  const initialScrollOffset = getBookListScrollOffset({
    bookIndex: initialScrollIndex,
    chapterIndex: selectedBookChapters
      ? selectedBookChapters.indexOf(selectedChapter)
      : selectedChapter - 1,
    windowWidth,
    viewportHeight: windowHeight - insets.top - SHEET_HEADER_ALLOWANCE,
  })
  const isGridChapterPicker = selectionMode === 'grid' && gridBook !== null

  useEffect(
    () => () => {
      Object.values(collapseTimeouts.current).forEach(clearTimeout)
    },
    []
  )

  // The provider sets a new state right before presenting, even when the tab data is unchanged:
  // every opening starts on the book being read
  const startOnSelectedBook = useEffectEvent(() => {
    if (isPresentedRef.current || !bookSelectorData) return

    const book = bookSelectorData.selectedBook
    Object.values(collapseTimeouts.current).forEach(clearTimeout)
    collapseTimeouts.current = {}
    expandedBook.set(book.Numero)
    setExpandedBookNumber(book.Numero)
    setRenderedChapterBookNumbers([book.Numero])
    setGridBook(book)
  })
  useEffect(() => {
    startOnSelectedBook()
  }, [bookSelectorState])

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
      <Sheet
        ref={sheetRef}
        backgroundColor={theme.colors.reverse}
        snapPoints={[1]}
        onPresent={() => {
          isPresentedRef.current = true
          if (data.length > 0) {
            flatListRef.current?.scrollToOffset({
              offset: initialScrollOffset,
              animated: false,
            })
          }
        }}
        onDismiss={() => {
          isPresentedRef.current = false
          expandedBook.set(null)
          setExpandedBookNumber(null)
          setGridBook(null)
          Object.values(collapseTimeouts.current).forEach(clearTimeout)
          collapseTimeouts.current = {}
          setRenderedChapterBookNumbers([])
        }}
        header={
          <>
            <SheetHeader
              title={
                isGridChapterPicker ? getReadingBookName(gridBook, selectedVersion) : t('Livres')
              }
              subTitle={isGridChapterPicker ? t('Chapitres') : undefined}
              centerTitle
              hasBackButton={isGridChapterPicker}
              leftComponent={
                isGridChapterPicker ? undefined : (
                  <Box className="overflow-hidden border-continuous w-[60px]" />
                )
              }
              onBackPress={isGridChapterPicker ? () => setGridBook(null) : undefined}
              rightComponent={
                isGridChapterPicker ? (
                  <Box className="overflow-hidden border-continuous w-[54px]" />
                ) : (
                  <BookSelectorParams />
                )
              }
            />
            {!isGridChapterPicker && (
              <HelpTip id="chapter-selector" description={t('tips.chapterSelector')} />
            )}
          </>
        }
      >
        <BookSelectorList
          key={selectedVersion}
          data={data}
          initialScrollOffset={initialScrollOffset}
          expandedBook={expandedBook}
          bookSelectorData={bookSelectorData}
          flatListRef={flatListRef}
          chaptersByBook={coverageData?.chaptersByBook}
          renderedChapterBookNumbers={renderedChapterBookNumbers}
          onBookSelect={handleBookSelect}
          gridBook={gridBook}
          onGridBookSelect={setGridBook}
        />
      </Sheet>
      <VerseSheet
        sheetRef={verseSheetRef}
        bookSelectorRef={sheetRef}
        actions={bookSelectorActions}
        data={bookSelectorData}
      />
    </>
  )
}

export default BookSelectorSheet
