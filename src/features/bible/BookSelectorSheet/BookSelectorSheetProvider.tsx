import { type SheetRef } from '~common/sheet'
import React, { createContext, useContext, useRef } from 'react'
import type { BibleTab, BibleTabActions } from '../../../state/tabs'
import BookSelectorSheet, { bookSelectorDataAtom } from './BookSelectorSheet'
import VersionSelectorSheet, {
  versionSelectorDataAtom,
} from '../VersionSelectorSheet/VersionSelectorSheet'
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

export const BookSelectorSheetProvider = ({ children }: { children: React.ReactNode }) => {
  const bookSheetRef = useRef<SheetRef>(null)
  const versionSheetRef = useRef<SheetRef>(null)
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
    bookSheetRef.current?.present()
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
    versionSheetRef.current?.present()
  }

  return (
    <BookSelectorContext.Provider value={{ openBookSelector, openVersionSelector }}>
      {children}
      <BookSelectorSheet sheetRef={bookSheetRef} />
      <VersionSelectorSheet sheetRef={versionSheetRef} />
    </BookSelectorContext.Provider>
  )
}
