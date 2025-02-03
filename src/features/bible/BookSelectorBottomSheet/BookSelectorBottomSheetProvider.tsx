import BottomSheet from '@gorhom/bottom-sheet'
import { PrimitiveAtom } from 'jotai/vanilla'
import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react'
import {
  BibleTab,
  defaultBibleAtom,
  useBibleTabActions,
} from '../../../state/tabs'
import BookSelectorBottomSheet from './BookSelectorBottomSheet'
import VersionSelectorBottomSheet from '../VersionSelectorBottomSheet/VersionSelectorBottomSheet'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { Book } from '~assets/bible_versions/books-desc'
import { DeviceEventEmitter } from 'react-native'

interface BookSelectorContextType {
  openBookSelector: (bibleAtom: PrimitiveAtom<BibleTab>) => void
  openVersionSelector: (
    bibleAtom: PrimitiveAtom<BibleTab>,
    parallelVersionIndex?: number
  ) => void
}

const BookSelectorContext = createContext<BookSelectorContextType | null>(null)

export const useBookAndVersionSelector = () => {
  const context = useContext(BookSelectorContext)
  if (!context) {
    throw new Error(
      'useBookAndVersionSelector must be used within a BookSelectorProvider'
    )
  }
  return context
}

export type SelectionEvent = {
  type: 'select' | 'longPress'
  book: Book
  chapter: number
}

// Définir une constante pour l'event name pour éviter les typos
export const BOOK_SELECTION_EVENT = 'book-selection'

export const BookSelectorBottomSheetProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const bookBottomSheetRef = useRef<BottomSheet>(null)
  const versionBottomSheetRef = useRef<BottomSheet>(null)
  const [currentBibleAtom, setCurrentBibleAtom] = useState<
    PrimitiveAtom<BibleTab>
  >(defaultBibleAtom)
  const [
    currentParallelVersionIndex,
    setCurrentParallelVersionIndex,
  ] = useState<number | undefined>(undefined)
  const bible = useAtomValue(currentBibleAtom)
  const actions = useBibleTabActions(currentBibleAtom)
  const openInNewTab = useOpenInNewTab()
  const {
    data: { selectionMode, ...rest },
  } = bible
  const { t } = useTranslation()

  const {
    data: { selectedBook },
  } = bible

  const openBookSelector = (bibleAtom: PrimitiveAtom<BibleTab>) => {
    setCurrentBibleAtom(bibleAtom)
    setTimeout(() => {
      bookBottomSheetRef.current?.expand()
    }, 150)
  }

  const openVersionSelector = (
    bibleAtom: PrimitiveAtom<BibleTab>,
    parallelVersionIndex?: number
  ) => {
    setCurrentBibleAtom(bibleAtom)
    setCurrentParallelVersionIndex(parallelVersionIndex)
    setTimeout(() => {
      console.log(versionBottomSheetRef.current)
      versionBottomSheetRef.current?.expand()
    }, 150)
  }

  // On écoute les événements de sélection
  useEffect(() => {
    const handleSelection = (event: SelectionEvent) => {
      const { type, book, chapter } = event

      if (type === 'select') {
        actions.setTempSelectedBook(book)
        actions.setTempSelectedChapter(chapter)
        actions.validateTempSelected()
        bookBottomSheetRef.current?.close()
      } else if (type === 'longPress') {
        bookBottomSheetRef.current?.close()
        setTimeout(() => {
          openInNewTab(
            {
              id: `bible-${Date.now()}`,
              title: t('tabs.new'),
              isRemovable: true,
              type: 'bible',
              data: {
                ...rest,
                selectionMode,
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

    const subscription = DeviceEventEmitter.addListener(
      BOOK_SELECTION_EVENT,
      handleSelection
    )

    return () => {
      subscription.remove()
    }
  }, [actions, openInNewTab, t, rest, selectionMode])

  return (
    <BookSelectorContext.Provider
      value={{ openBookSelector, openVersionSelector }}
    >
      {children}
      <BookSelectorBottomSheet
        bottomSheetRef={bookBottomSheetRef}
        selectedBookNum={selectedBook.Numero}
      />
      <VersionSelectorBottomSheet
        bottomSheetRef={versionBottomSheetRef}
        bibleAtom={currentBibleAtom}
        parallelVersionIndex={currentParallelVersionIndex}
      />
    </BookSelectorContext.Provider>
  )
}
