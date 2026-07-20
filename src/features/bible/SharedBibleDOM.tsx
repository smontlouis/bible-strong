import * as Sentry from '@sentry/react-native'
import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai'
import { useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import { Portal, PortalHost } from 'react-native-teleport'
import { useSelector } from 'react-redux'

import { bibleDomRemountSignalAtom } from '~state/app'
import {
  activeBibleTabIdAtom,
  bibleDOMHostLayoutsAtom,
  getDefaultBibleTab,
  sharedBibleDOMPropsAtom,
} from '~state/tabs'
import type { WebViewProps } from './BibleDOM/BibleDOMWrapper'
import { BibleDOMWrapper } from './BibleDOM/BibleDOMWrapper'
import type { RootState } from '~redux/modules/reducer'

export const getBibleDOMDestination = (tabId: string) => `bible-dom-${tabId}`
const SHARED_BIBLE_DOM_PARK_HOST = 'bible-dom-parked'

// Static default atom for pre-warming the WebView
const defaultBibleTab = getDefaultBibleTab()
const defaultBibleAtom = atom(defaultBibleTab)

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
  const activeBibleTabId = useAtomValue(activeBibleTabIdAtom)
  const bibleDOMHostLayouts = useAtomValue(bibleDOMHostLayoutsAtom)
  const sharedProps = useAtomValue(sharedBibleDOMPropsAtom)
  const bibleDomRemountSignal = useAtomValue(bibleDomRemountSignalAtom)
  const settings = useSelector((state: RootState) => state.user.bible.settings)

  const activeProps =
    activeBibleTabId && sharedProps?.tabId === activeBibleTabId ? sharedProps : null
  const activeHostLayout = activeBibleTabId ? bibleDOMHostLayouts[activeBibleTabId] : undefined
  const destination =
    activeBibleTabId && activeProps
      ? getBibleDOMDestination(activeBibleTabId)
      : SHARED_BIBLE_DOM_PARK_HOST
  const portalLayoutKey = activeHostLayout
    ? `${activeHostLayout.width}x${activeHostLayout.height}`
    : '0x0'

  const prevDestination = useRef<string | undefined>(undefined)
  if (prevDestination.current !== destination) {
    Sentry.addBreadcrumb({
      category: 'bible-dom',
      message: 'Portal retarget',
      data: { from: prevDestination.current ?? null, to: destination },
      level: 'info',
    })
    prevDestination.current = destination
  }

  // Default props to pre-warm the WebView (empty verses, no-op callbacks)
  const defaultProps: WebViewProps = {
    tabId: defaultBibleTab.id,
    bibleAtom: defaultBibleAtom,
    book: defaultBibleTab.data.selectedBook,
    chapter: defaultBibleTab.data.selectedChapter,
    isLoading: true,
    addSelectedVerse: noop,
    removeSelectedVerse: noop,
    setSelectedVerse: noop,
    version: defaultBibleTab.data.selectedVersion,
    contextDisplayMode: 'fullChapter',
    isSelectionMode: undefined,
    verses: [],
    parallelVerses: [],
    focusVerses: undefined,
    secondaryVerses: null,
    selectedVerses: {},
    highlightedVerses: {},
    notedVerses: {},
    allNotes: {},
    bookmarkedVerses: {},
    linkedVerses: {},
    allLinks: {},
    studyRelations: {},
    wordAnnotations: {},
    settings,
    verseToScroll: undefined,
    pericopeChapter: {},
    setSelectedCode: noop,
    selectedCode: null,
    comments: null,
  }

  const props = activeProps ?? defaultProps

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: -9999, pointerEvents: 'none' }]}>
      <PortalHost name={SHARED_BIBLE_DOM_PARK_HOST} style={StyleSheet.absoluteFill} />
      <Portal key={`${destination}-${portalLayoutKey}`} hostName={destination}>
        <BibleDOMWrapper
          key={`${bibleDomRemountSignal}-${destination}-${portalLayoutKey}`}
          {...props}
        />
      </Portal>
    </View>
  )
}

export default SharedBibleDOM
