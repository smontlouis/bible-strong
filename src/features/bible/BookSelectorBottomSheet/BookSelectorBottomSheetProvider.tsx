import BottomSheet from '@gorhom/bottom-sheet'
import { atom, PrimitiveAtom } from 'jotai/vanilla'
import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'
import { BibleTab, BibleTabActions, useBibleTabActions } from '../../../state/tabs'
import BookSelectorBottomSheet, { bookSelectorDataAtom } from './BookSelectorBottomSheet'
import VersionSelectorBottomSheet, {
  versionSelectorDataAtom,
} from '../VersionSelectorBottomSheet/VersionSelectorBottomSheet'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { Book } from '~assets/bible_versions/books-desc'
import { DeviceEventEmitter } from 'react-native'

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
  const bookBottomSheetRef = useRef<BottomSheet>(null)
  const versionBottomSheetRef = useRef<BottomSheet>(null)
  const setBookSelectorData = useSetAtom(bookSelectorDataAtom)
  const setVersionSelectorData = useSetAtom(versionSelectorDataAtom)

  const { t } = useTranslation()

  const openBookSelector = ({
    actions,
    data,
  }: {
    actions: BibleTabActions
    data: BibleTab['data']
  }) => {
    setBookSelectorData({ actions, data })
    bookBottomSheetRef.current?.expand()
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
    versionBottomSheetRef.current?.expand()
  }

  return (
    <BookSelectorContext.Provider value={{ openBookSelector, openVersionSelector }}>
      {children}
      <BookSelectorBottomSheet bottomSheetRef={bookBottomSheetRef} />
      <VersionSelectorBottomSheet bottomSheetRef={versionBottomSheetRef} />
    </BookSelectorContext.Provider>
  )
}
