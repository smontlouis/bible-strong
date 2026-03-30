import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai'
import { View, StyleSheet } from 'react-native'
import { Portal } from 'react-native-teleport'
import { useSelector } from 'react-redux'

import { isOnboardingCompletedAtom } from '~features/onboarding/atom'
import { activeBibleTabIdAtom, sharedBibleDOMPropsAtom, getDefaultBibleTab } from '~state/tabs'
import type { WebViewProps } from './BibleDOM/BibleDOMWrapper'
import { BibleDOMWrapper } from './BibleDOM/BibleDOMWrapper'
import type { RootState } from '~redux/modules/reducer'

export const getBibleDOMDestination = (tabId: string) => `bible-dom-${tabId}`

// Static default atom and reload atom for pre-warming the WebView
const defaultBibleTab = getDefaultBibleTab()
const defaultBibleAtom = atom(defaultBibleTab)
const defaultReloadAtom = atom(false)

const noop = () => {}

/**
 * Single shared BibleDOMWrapper instance that gets portaled to the active
 * Bible tab's PortalHost. When no Bible tab is active, it stays offscreen
 * to keep the WebView alive and warm (fonts loaded, CSS compiled).
 *
 * On first mount, renders with default (empty) props so the WebView
 * initializes during splash screen. When a real BibleViewer pushes its
 * props, it just updates content — no init cost.
 */
const SharedBibleDOM = () => {
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom)
  const activeBibleTabId = useAtomValue(activeBibleTabIdAtom)
  const sharedProps = useAtomValue(sharedBibleDOMPropsAtom)
  const settings = useSelector((state: RootState) => state.user.bible.settings)

  const destination = activeBibleTabId ? getBibleDOMDestination(activeBibleTabId) : undefined

  // Don't render Portal content until onboarding is completed.
  // This prevents a race condition where the Portal's WebView exists
  // before any PortalHost is mounted, causing a NullPointerException
  // in react-native-teleport when the host finally appears.
  if (!isOnboardingCompleted) return null

  // Default props to pre-warm the WebView (empty verses, no-op callbacks)
  const defaultProps: WebViewProps = {
    bibleAtom: defaultBibleAtom,
    isBibleViewReloadingAtom: defaultReloadAtom,
    book: defaultBibleTab.data.selectedBook,
    chapter: defaultBibleTab.data.selectedChapter,
    isLoading: true,
    addSelectedVerse: noop,
    removeSelectedVerse: noop,
    setSelectedVerse: noop,
    version: defaultBibleTab.data.selectedVersion,
    isReadOnly: false,
    isSelectionMode: undefined,
    verses: [],
    parallelVerses: [],
    focusVerses: undefined,
    secondaryVerses: null,
    selectedVerses: {},
    highlightedVerses: {},
    notedVerses: {},
    bookmarkedVerses: {},
    linkedVerses: {},
    wordAnnotations: {},
    settings,
    verseToScroll: undefined,
    pericopeChapter: {},
    setSelectedCode: noop,
    selectedCode: null,
    comments: null,
  }

  const props = sharedProps ?? defaultProps

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: -9999, pointerEvents: 'none' }]}>
      <Portal hostName={destination}>
        <BibleDOMWrapper {...props} />
      </Portal>
    </View>
  )
}

export default SharedBibleDOM
