import { BottomSheetModal } from '~common/bottom-sheet'
import React, { createContext, useContext, useRef } from 'react'
import type { BibleTab, BibleTabActions } from '../../../state/tabs'
import BookSelectorBottomSheet, { bookSelectorDataAtom } from './BookSelectorBottomSheet'
import VersionSelectorBottomSheet, {
  versionSelectorDataAtom,
} from '../VersionSelectorBottomSheet/VersionSelectorBottomSheet'
import { useSetAtom } from 'jotai/react'

interface BookSelectorContextType {
  openBookSelector: ({
    actions,
    data,
  }: {
    actions: BibleTabActions
    data: BibleTab['data']
  }) => void
  openVersionSelector: ({
    actions,
    data,
    parallelVersionIndex,
  }: {
    actions: Pick<BibleTabActions, 'setSelectedVersion' | 'setParallelVersion'>
    data: BibleTab['data']
    parallelVersionIndex?: number
  }) => void
}

const BookSelectorContext = createContext<BookSelectorContextType | null>(null)

export const useBookAndVersionSelector = () => {
  const context = useContext(BookSelectorContext)
  if (!context) {
    throw new Error('useBookAndVersionSelector must be used within a BookSelectorProvider')
  }
  return context
}

export const BookSelectorBottomSheetProvider = ({ children }: { children: React.ReactNode }) => {
  const bookBottomSheetRef = useRef<BottomSheetModal>(null)
  const versionBottomSheetRef = useRef<BottomSheetModal>(null)
  const setBookSelectorData = useSetAtom(bookSelectorDataAtom)
  const setVersionSelectorData = useSetAtom(versionSelectorDataAtom)

  const openBookSelector = ({
    actions,
    data,
  }: {
    actions: BibleTabActions
    data: BibleTab['data']
  }) => {
    setBookSelectorData({ actions, data })
    bookBottomSheetRef.current?.present()
  }

  const openVersionSelector = ({
    actions,
    data,
    parallelVersionIndex,
  }: {
    actions: Pick<BibleTabActions, 'setSelectedVersion' | 'setParallelVersion'>
    data: BibleTab['data']
    parallelVersionIndex?: number
  }) => {
    setVersionSelectorData({ actions, data, parallelVersionIndex })
    versionBottomSheetRef.current?.present()
  }

  return (
    <BookSelectorContext.Provider value={{ openBookSelector, openVersionSelector }}>
      {children}
      <BookSelectorBottomSheet bottomSheetRef={bookBottomSheetRef} />
      <VersionSelectorBottomSheet bottomSheetRef={versionBottomSheetRef} />
    </BookSelectorContext.Provider>
  )
}
