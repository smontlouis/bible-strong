import * as Sentry from '@sentry/react-native'
import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai'
import { useRef, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Portal, PortalHost } from 'react-native-teleport'
import { useSelector } from 'react-redux'

import { isOnboardingCompletedAtom } from '~features/onboarding/atom'
import { activeBibleTabIdAtom, sharedBibleDOMPropsAtom, getDefaultBibleTab } from '~state/tabs'
import type { WebViewProps } from './BibleDOM/BibleDOMWrapper'
import { BibleDOMWrapper } from './BibleDOM/BibleDOMWrapper'
import type { RootState } from '~redux/modules/reducer'

export const getBibleDOMDestination = (tabId: string) => `bible-dom-${tabId}`
const SHARED_BIBLE_DOM_PARK_HOST = 'bible-dom-parked'

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

  const activeProps =
    activeBibleTabId && sharedProps?.tabId === activeBibleTabId ? sharedProps : null
  const destination =
    activeBibleTabId && activeProps
      ? getBibleDOMDestination(activeBibleTabId)
      : SHARED_BIBLE_DOM_PARK_HOST

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

  // Self-healing: if the BibleDOMWrapper never mounts (white screen bug),
  // remount it by bumping a local key. Max 2 retries to avoid infinite loops.
  const [reloadKey, setReloadKey] = useState(0)

  // Don't render Portal content until onboarding is completed.
  // This prevents a race condition where the Portal's WebView exists
  // before a PortalHost is mounted, causing a NullPointerException
  // in react-native-teleport when the host finally appears.
  if (!isOnboardingCompleted) return null

  // Default props to pre-warm the WebView (empty verses, no-op callbacks)
  const defaultProps: WebViewProps = {
    tabId: defaultBibleTab.id,
    bibleAtom: defaultBibleAtom,
    isBibleViewReloadingAtom: defaultReloadAtom,
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

  const MAX_RETRIES = 2
  const handleMountTimeout = () => {
    // Still call the upstream onMountTimeout (e.g. BibleTabScreen's reload)
    props.onMountTimeout?.()
    if (reloadKey < MAX_RETRIES) {
      Sentry.captureMessage('SharedBibleDOM remounting WebView after mount timeout', {
        level: 'warning',
        tags: { reloadKey: String(reloadKey) },
      })
      setReloadKey(k => k + 1)
    } else {
      Sentry.captureMessage('SharedBibleDOM: max retries exhausted, WebView still not mounted', {
        level: 'error',
        tags: { reloadKey: String(reloadKey) },
      })
    }
  }

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: -9999, pointerEvents: 'none' }]}>
      <PortalHost name={SHARED_BIBLE_DOM_PARK_HOST} style={StyleSheet.absoluteFill} />
      <Portal hostName={destination}>
        <BibleDOMWrapper key={reloadKey} {...props} onMountTimeout={handleMountTimeout} />
      </Portal>
    </View>
  )
}

export default SharedBibleDOM
