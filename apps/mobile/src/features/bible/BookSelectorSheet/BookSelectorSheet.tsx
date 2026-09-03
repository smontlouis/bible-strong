import { Sheet, SheetHeader, type SheetRef } from '~common/sheet'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { useAtomValue, useSetAtom } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { DeviceEventEmitter, FlatList } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'
import { BibleTab, BibleTabActions } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import Box from '~common/ui/Box'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { HelpTip } from '~features/tips/HelpTip'
import { bookSelectorSelectionModeAtom, bookSelectorSortAtom, bookSelectorVersesAtom } from './atom'
import { itemHeight } from './BookItem'
import { BookSelectorList } from './BookSelectorList'
import { BookSelectorParams } from './BookSelectorParams'
import { BOOK_SELECTION_EVENT, SelectionEvent } from './constants'
import VerseSheet, { tempSelectedBookAtom, tempSelectedChapterAtom } from './VerseSheet'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@emotion/react'
import { applyBookChapterSelection } from './bookSelectorSelection'
import { getBooksForCanon, isBibleCanonId } from '~helpers/bibleBookCatalog'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { staticResourceQueryOptions } from '~helpers/queryOptions'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
interface BookSelectorSheetProps {
  selectedBookNum?: number
  sheetRef: React.RefObject<SheetRef | null>
}

export const bookSelectorDataAtom = atom<{
  actions?: BibleTabActions
  data?: BibleTab['data']
  coverage?: BibleVersionCoverage
}>({})

const BookSelectorSheet = ({ sheetRef }: BookSelectorSheetProps) => {
  const expandedBook = useSharedValue<number | null>(null)
  const [expandedBookNumber, setExpandedBookNumber] = useState<number | null>(null)
  const [renderedChapterBookNumbers, setRenderedChapterBookNumbers] = useState<number[]>([])
  const [gridBook, setGridBook] = useState<Book | null>(null)
  const collapseTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const flatListRef = useRef<FlatList>(null)
  const { t } = useTranslation()
  const sort = useAtomValue(bookSelectorSortAtom)
  const isAlphabetical = sort === 'alphabetical'
  const selectionMode = useAtomValue(bookSelectorSelectionModeAtom)
  const verses = useAtomValue(bookSelectorVersesAtom)
  const bookSelectorHasVerses = verses === 'with-verses'
  const setTempSelectedBook = useSetAtom(tempSelectedBookAtom)
  const setTempSelectedChapter = useSetAtom(tempSelectedChapterAtom)
  const {
    actions: bookSelectorActions,
    data: bookSelectorData,
    coverage: providedCoverage,
  } = useAtomValue(bookSelectorDataAtom)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookSelectorActions, openInNewTab, t, bookSelectorData, bookSelectorHasVerses])

  const data = useMemo(() => {
    const booksArray = getBooksForCanon(canonId, coverageData?.books)
    if (isAlphabetical) {
      return [...booksArray].sort((a, b) => a.Nom.localeCompare(b.Nom))
    }
    return booksArray
  }, [canonId, coverageData?.books, isAlphabetical])

  const initialScrollIndex = data.findIndex(
    book => book.Numero === (bookSelectorData?.selectedBook.Numero || 1)
  )
  const safeInitialScrollIndex = Math.max(initialScrollIndex, 0)
  const isGridChapterPicker = selectionMode === 'grid' && gridBook !== null

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
      <Sheet
        ref={sheetRef}
        backgroundColor={theme.colors.reverse}
        snapPoints={[1]}
        onPresent={() => {
          if (data.length > 0) {
            flatListRef.current?.scrollToOffset({
              offset: Math.max(0, itemHeight * (safeInitialScrollIndex - 2)),
              animated: false,
            })
          }
        }}
        onDismiss={() => {
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
              title={isGridChapterPicker ? t(gridBook.Nom) : t('Livres')}
              subTitle={isGridChapterPicker ? t('Chapitres') : undefined}
              centerTitle
              hasBackButton={isGridChapterPicker}
              leftComponent={isGridChapterPicker ? undefined : <Box width={60} />}
              onBackPress={isGridChapterPicker ? () => setGridBook(null) : undefined}
              rightComponent={isGridChapterPicker ? <Box width={54} /> : <BookSelectorParams />}
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
          initialScrollIndex={safeInitialScrollIndex}
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
