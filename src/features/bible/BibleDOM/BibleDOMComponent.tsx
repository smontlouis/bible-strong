'use dom'

import { setup, styled, keyframes } from 'goober'
import { createGlobalStyles } from 'goober/global'
import React, { useEffect, useState, useRef } from 'react'
import { Verse as TVerse } from '~common/types'
import {
  Dispatch,
  LinkedVerse,
  NotedVerse,
  ParallelVerse,
  RootStyles,
  TaggedVerse,
  WebViewProps,
} from './BibleDOMWrapper'
import ChevronDownIcon from './ChevronDownIcon'
import Comment from './Comment'
import {
  ENTER_ANNOTATION_MODE,
  ENTER_READONLY_MODE,
  EXIT_READONLY_MODE,
  NAVIGATE_TO_PERICOPE,
  NAVIGATE_TO_VERSION,
  SWIPE_LEFT,
  SWIPE_RIGHT,
  SWIPE_DOWN,
  SWIPE_UP,
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  TOGGLE_INT_COMPLETE,
  TOGGLE_SELECTED_VERSE,
} from './dispatch'
import { DispatchProvider } from './DispatchProvider'
import { TranslationsProvider, BibleDOMTranslations } from './TranslationsContext'
import { scaleFontSize } from './scaleFontSize'
import { useFonts } from 'expo-font'
import { HEADER_HEIGHT, HEADER_HEIGHT_MIN } from '~features/app-switcher/utils/constants'
// Annotation mode imports
import { AnnotationType } from './AnnotationMode'
import {
  HighlightLayer,
  HighlightRectDiv,
  getAnimationDelay,
} from './AnnotationMode/HighlightComponents'
import { useAnnotationHighlights } from './AnnotationMode/useAnnotationHighlights'
import { SelectionHandles } from './AnnotationMode/SelectionHandles'
import { useAnnotationModeController } from './AnnotationMode/useAnnotationModeController'
import { SelectionRange } from './AnnotationMode/selectionUtils'
import { tokenizeVerseText, WordToken, getWordIndexFromCharOffset } from '~helpers/wordTokenizer'
import { getCaretInfoFromPoint } from './AnnotationMode/domUtils'
// Unified verse renderer
import { UnifiedVersesRenderer } from './UnifiedVersesRenderer'
import { isDarkTheme } from './utils'

declare global {
  interface Window {
    disableSwipeDownEvent: boolean
  }
}

const forwardProps = [
  'settings',
  'isFocused',
  'isParallel',
  'isParallelVerse',
  'isTouched',
  'isSelected',
  'isVerseToScroll',
  'highlightedColor',
  'highlightBg',
  'highlightColor',
  'redColor',
  'isSelectedMode',
  'fadePosition',
  'isButton',
  'isDisabled',
  'columnCount',
  'columnWidth',
  'rtl',
]
setup(React.createElement, undefined, undefined, (props: object) => {
  const forwardedProps = props as Record<string, unknown>
  for (let prop in forwardedProps) {
    if (prop[0] === '$' || forwardProps.includes(prop)) {
      delete forwardedProps[prop]
    }
  }
})

// Global CSS for @property (required for animating CSS custom properties)
const GlobalStyles = createGlobalStyles`
  @property --draw-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }
` as React.FC

type Props = Pick<
  WebViewProps,
  | 'verses'
  | 'parallelVerses'
  | 'parallelColumnWidth'
  | 'parallelDisplayMode'
  | 'focusVerses'
  | 'secondaryVerses'
  | 'selectedVerses'
  | 'highlightedVerses'
  | 'bookmarkedVerses'
  | 'wordAnnotations'
  | 'wordAnnotationsInOtherVersions'
  | 'taggedVersesInChapter'
  | 'versesWithNonHighlightTags'
  | 'settings'
  | 'verseToScroll'
  | 'isReadOnly'
  | 'version'
  | 'pericopeChapter'
  | 'book'
  | 'chapter'
  | 'isSelectionMode'
  | 'selectedCode'
  | 'redWords'
> & {
  dispatch: Dispatch
  dom: import('expo/dom').DOMProps
  translations: BibleDOMTranslations
  isINTComplete: boolean
  // Pre-computed metadata from native side
  comments: { [key: string]: string } | null
  taggedVerses: TaggedVerse[] | null
  versesWithAnnotationNotes: Record<string, boolean>
  notedVersesCount: { [key: string]: number }
  notedVersesText: { [key: string]: NotedVerse[] }
  linkedVersesCount: { [key: string]: number }
  linkedVersesText: { [key: string]: LinkedVerse[] }
  studyRelationsCount: { [key: string]: number }
  // Annotation mode props (uncontrolled - DOM manages local annotation state)
  annotationMode?: boolean
  clearSelectionTrigger?: number
  applyAnnotationTrigger?: { count: number; color: string; type: AnnotationType }
  eraseSelectionTrigger?: number
  clearAnnotationSelectionTrigger?: number
  selectedAnnotationId?: string | null
  // Safe area inset from native side (CSS env vars don't work in Expo DOM WebView)
  safeAreaTop?: number
}

const extractParallelVersionTitles = (parallelVerses: ParallelVerse[], currentVersion: string) => {
  if (!parallelVerses?.length) return []

  return [
    { id: currentVersion, error: undefined },
    ...parallelVerses.map(p => ({ id: p.id, error: p.error })),
  ]
}

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const Container = styled('div')<RootStyles & { rtl: boolean; isParallelVerse: boolean }>(
  ({ settings: { alignContent, theme, colors }, rtl, isParallelVerse }) => ({
    position: 'relative', // For highlight layer positioning
    maxWidth: isParallelVerse ? 'none' : '800px',
    margin: '0 auto',
    padding: '10px 15px',
    paddingBottom: '300px',
    textAlign: alignContent,
    background: colors[theme].reverse,
    color: colors[theme].default,
    direction: rtl ? 'rtl' : 'ltr',
    paddingTop: `${HEADER_HEIGHT + 10}px`,
    animation: `${fadeIn} 300ms ease-out`,
    ...(rtl ? { textAlign: 'right' } : {}),
  })
)

const RightDirection = styled('div')<RootStyles>(({ settings: { theme, colors } }) => ({
  textAlign: 'right',
  marginBottom: '20px',
  fontFamily: 'arial',
  fontSize: '13px',
  color: colors[theme].darkGrey,
}))

const IntMode = styled('div')<RootStyles>(({ settings: { theme, colors, fontFamily } }) => ({
  fontFamily,
  webkitTouchCallout: 'none',
  mozUserSelect: 'none',
  msUserSelect: 'none',
  khtmlUserSelect: 'none',
  webkitUserSelect: 'none',
  color: colors[theme].default,
  fontSize: '14px',
  display: 'inline-block',

  backgroundColor: colors[theme].reverse,
  boxShadow: isDarkTheme(theme)
    ? `0 0 10px 0 rgba(255, 255, 255, 0.1)`
    : `0 0 10px 0 rgba(0, 0, 0, 0.2)`,
  borderRadius: '8px',
  paddingInline: '8px',
  paddingBlock: '4px',
  wordBreak: 'break-word',
  marginInline: '4px',
  transition: 'opacity 0.2s ease-in-out',

  cursor: 'pointer',
  '&:active': {
    opacity: 0.6,
  },
}))

const VersionTitle = styled('div')<RootStyles>(
  ({ settings: { fontSizeScale, fontFamily, colors, theme } }) => ({
    fontFamily,
    fontWeight: 'bold',
    fontSize: scaleFontSize(16, fontSizeScale),
    position: 'sticky',
    left: 0,
    // Use CSS variable for translateX - more performant than direct style manipulation
    transform: 'translateX(var(--translate-x, 0px))',
    webkitTouchCallout: 'none',
    mozUserSelect: 'none',
    msUserSelect: 'none',
    khtmlUserSelect: 'none',
    webkitUserSelect: 'none',
    color: colors[theme].default,

    backgroundColor: colors[theme].reverse,
    boxShadow: isDarkTheme(theme)
      ? `0 0 10px 0 rgba(255, 255, 255, 0.1)`
      : `0 0 10px 0 rgba(0, 0, 0, 0.2)`,
    borderRadius: '8px',
    paddingInlineEnd: '8px',
    paddingInlineStart: '4px',
    paddingBlock: '4px',
    wordBreak: 'break-word',
    marginInline: '4px',
    cursor: 'pointer',
    '&:active': {
      opacity: 0.6,
    },
  })
)

const VersionErrorIndicator = styled('span')<RootStyles>(({ settings: { theme, colors } }) => ({
  color: colors[theme].quart,
  marginLeft: '4px',
  fontSize: '12px',
}))

const VersionsContainer = styled('div')<{ columnCount: number; columnWidth: number }>(
  ({ columnCount, columnWidth }) => ({
    position: 'relative',
    display: 'flex',
    paddingTop: '5px',
    paddingBottom: '10px',
    // Largeur totale = colonnes * columnWidth vw
    width: columnCount > 1 ? `${columnCount * columnWidth}vw` : '100%',
    minWidth: columnCount > 1 ? `${columnCount * columnWidth}vw` : '100%',
    transition: 'width 0.4s ease-in-out',
  })
)

// Wrapper pour le scroll horizontal (content)
const HorizontalScrollWrapper = styled('div')<{ columnCount: number }>(({ columnCount }) => ({
  overflowX: columnCount > 1 ? 'auto' : 'visible',
  scrollBehavior: 'smooth',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
}))

// Wrapper pour le header avec scroll synchronisé (pas de scrollbar visible)
const HeaderScrollWrapper = styled('div')<{ columnCount: number }>(({ columnCount }) => ({
  position: 'sticky',
  top: 'var(--header-height)',
  zIndex: 2,
  transition: 'top 0.3s cubic-bezier(.13,.69,.5,.98)',
  overflowX: columnCount > 1 ? 'auto' : 'visible',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
  // Disable pointer events on wrapper to prevent direct scroll, enable on children
  pointerEvents: columnCount > 1 ? 'none' : 'auto',
  '& > *': {
    pointerEvents: 'auto',
  },
}))

// Colonne pour chaque version dans le header
const VersionTitleColumn = styled('div')<{ columnCount: number; columnWidth: number }>(
  ({ columnCount, columnWidth }) => ({
    width: columnCount > 1 ? `${columnWidth}vw` : '100%',
    minWidth: columnCount > 1 ? `${columnWidth}vw` : '100%',
    transition: 'width 0.4s ease-in-out',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
  })
)

const ReadWholeChapterButtonContainer = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: '20px',
  marginBottom: '20px',
})

const ReadWholeChapterButton = styled('button')<RootStyles>(({ settings: { theme, colors } }) => ({
  backgroundColor: colors[theme].opacity5,
  color: colors[theme].primary,
  border: 'none',
  borderRadius: '100px',
  padding: '12px 18px',
  fontSize: '14px',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: 'all 0.2s',
  '&:hover': {
    opacity: 0.6,
  },
}))

/** Build a verseKey ("Livre-Chapitre-Verset") for a verse */
function verseKey(v: TVerse): string {
  return `${v.Livre}-${v.Chapitre}-${v.Verset}`
}

/** Build a Map from verseKey to Verse for O(1) lookups */
function buildVersesMap(verses: TVerse[]): Map<string, TVerse> {
  const map = new Map<string, TVerse>()
  for (const v of verses) {
    map.set(verseKey(v), v)
  }
  return map
}

/**
 * Hit-test a click position against highlight rects to find a clicked annotation.
 * Returns the annotationId if found, or null.
 */
function findClickedAnnotationId(
  highlightRects: {
    type: string
    annotationId?: string
    left: number
    top: number
    width: number
    height: number
  }[],
  containerRect: DOMRect,
  position: { x: number; y: number }
): string | null {
  const clickX = position.x - containerRect.left
  const clickY = position.y - containerRect.top

  const clickedRect = highlightRects.find(
    rect =>
      rect.type === 'annotation' &&
      rect.annotationId &&
      clickX >= rect.left &&
      clickX <= rect.left + rect.width &&
      clickY >= rect.top &&
      clickY <= rect.top + rect.height
  )

  return clickedRect?.annotationId ?? null
}

/**
 * Hit-test a click position against selection rects.
 * Returns true if the click is inside a selection rect.
 */
function isClickInsideSelection(
  highlightRects: { type: string; left: number; top: number; width: number; height: number }[],
  containerRect: DOMRect,
  position: { x: number; y: number }
): boolean {
  const clickX = position.x - containerRect.left
  const clickY = position.y - containerRect.top

  return highlightRects.some(
    rect =>
      rect.type === 'selection' &&
      clickX >= rect.left &&
      clickX <= rect.left + rect.width &&
      clickY >= rect.top &&
      clickY <= rect.top + rect.height
  )
}

// ============================================================================
// LOADED BIBLE CONTENT (heavy component, only rendered when verses are available)
// ============================================================================

const LoadedBibleContent = ({
  verses,
  parallelVerses,
  parallelColumnWidth = 75,
  parallelDisplayMode = 'horizontal',
  focusVerses,
  secondaryVerses,
  comments,
  selectedVerses,
  highlightedVerses,
  bookmarkedVerses,
  wordAnnotations,
  wordAnnotationsInOtherVersions,
  taggedVersesInChapter,
  versesWithNonHighlightTags,
  settings,
  verseToScroll,
  isReadOnly,
  version,
  pericopeChapter,
  book,
  chapter,
  isSelectionMode,
  selectedCode,
  dispatch,
  translations,
  annotationMode,
  clearSelectionTrigger,
  applyAnnotationTrigger,
  eraseSelectionTrigger,
  selectedAnnotationId,
  redWords,
  isINTComplete,
  // Pre-computed metadata from native side
  taggedVerses,
  versesWithAnnotationNotes,
  notedVersesCount,
  notedVersesText,
  linkedVersesCount,
  linkedVersesText,
  studyRelationsCount,
}: Props) => {
  // Ref for highlight layer
  const containerRef = useRef<HTMLDivElement>(null)

  // Refs for horizontal scroll sync between header and content
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)

  // Annotation mode state (lifted here to break circular dependency)
  const [selection, setSelection] = useState<SelectionRange | null>(null)
  const [tokensCache] = useState<Map<string, WordToken[]>>(() => new Map())

  // Clear tokens cache and selection when version changes to avoid stale word indices
  useEffect(() => {
    tokensCache.clear()
    setSelection(null)
  }, [version])

  // Build a Map from verseKey to Verse for O(1) lookups
  const versesMap = buildVersesMap(verses)

  // State for touched verse (for visual feedback)
  const [touchedVerseKey, setTouchedVerseKey] = useState<string | null>(null)

  // Tokens getter function with caching
  // Cache key includes text length and first char to detect content mismatch
  const getTokens = (verseKey: string, text: string): WordToken[] => {
    const cacheKey = `${verseKey}:${text.length}:${text.charCodeAt(0) || 0}`
    if (!tokensCache.has(cacheKey)) {
      tokensCache.set(cacheKey, tokenizeVerseText(text))
    }
    return tokensCache.get(cacheKey)!
  }

  // Use shared hook for annotation highlights (with selection support when in annotation mode)
  const { highlightRects, selectionHandlePositions } = useAnnotationHighlights({
    containerRef,
    wordAnnotations,
    version,
    book: book.Numero,
    chapter,
    verses,
    settings,
    // Pass selection only when in annotation mode
    selection: annotationMode ? selection : undefined,
    getTokens: annotationMode ? getTokens : undefined,
  })

  // Gesture handlers for unified touch selection

  const handleTapVerseAnnotationMode = (vKey: string, position: { x: number; y: number }) => {
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    // Check if clicked on an annotation
    const clickedAnnotationId = findClickedAnnotationId(highlightRects, containerRect, position)

    if (clickedAnnotationId) {
      setSelection(null)
      const newAnnotationId =
        clickedAnnotationId === selectedAnnotationId ? null : clickedAnnotationId
      dispatch({
        type: 'ANNOTATION_SELECTED',
        payload: { annotationId: newAnnotationId },
      }).catch(console.error)
      return
    }

    // Don't clear selection if clicking inside it
    if (isClickInsideSelection(highlightRects, containerRect, position)) {
      return
    }

    // Clear annotation selection
    if (selectedAnnotationId) {
      dispatch({
        type: 'ANNOTATION_SELECTED',
        payload: { annotationId: null },
      }).catch(console.error)
    }

    // If there's already a selection, clear it
    if (selection) {
      setSelection(null)
      return
    }

    // No selection exists -- create one on the clicked word
    const verse = versesMap.get(vKey)
    if (!verse) return

    const tokens = getTokens(vKey, verse.Texte)
    const caretInfo = getCaretInfoFromPoint(position.x, position.y)
    if (!caretInfo) return

    const wordIndex = getWordIndexFromCharOffset(tokens, caretInfo.charOffset)
    if (wordIndex === null) return

    setSelection({
      start: { verseKey: vKey, wordIndex },
      end: { verseKey: vKey, wordIndex },
    })
  }

  const handleTapVerseSelectionMode = (vKey: string) => {
    if (isSelectionMode?.includes('verse')) {
      dispatch({
        type: TOGGLE_SELECTED_VERSE,
        payload: vKey,
      }).catch(console.error)
      return
    }

    if (isSelectionMode?.includes('strong')) {
      const verse = versesMap.get(vKey)
      if (verse) {
        dispatch({
          type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
          params: {
            isSelectionMode,
            verse,
          },
        }).catch(console.error)
      }
    }
  }

  const handleTapVerseNormalMode = (vKey: string) => {
    const isSelectedMode = Boolean(Object.keys(selectedVerses).length)
    if (isSelectedMode || settings.press === 'longPress') {
      dispatch({
        type: TOGGLE_SELECTED_VERSE,
        payload: vKey,
      }).catch(console.error)
    } else {
      const verse = versesMap.get(vKey)
      if (verse) {
        dispatch({
          type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
          params: { verse },
        }).catch(console.error)
      }
    }
  }

  const handleTapVerse = (verseKey: string, position: { x: number; y: number }) => {
    if (annotationMode) {
      handleTapVerseAnnotationMode(verseKey, position)
      return
    }

    if (isSelectionMode) {
      handleTapVerseSelectionMode(verseKey)
      return
    }

    handleTapVerseNormalMode(verseKey)
  }

  const handleDoubleTapVerse = (vKey: string, position: { x: number; y: number }) => {
    // Find the word at the double-tap position
    const verse = versesMap.get(vKey)
    if (!verse) return

    const tokens = getTokens(vKey, verse.Texte)
    const caretInfo = getCaretInfoFromPoint(position.x, position.y)

    let newSelection: SelectionRange | null = null
    if (caretInfo) {
      const wordIndex = getWordIndexFromCharOffset(tokens, caretInfo.charOffset)
      if (wordIndex !== null) {
        newSelection = {
          start: { verseKey: vKey, wordIndex },
          end: { verseKey: vKey, wordIndex },
        }
      }
    }

    // Check if double-tap is on an existing annotation
    const containerRect = containerRef.current?.getBoundingClientRect()
    const clickedId = containerRect
      ? findClickedAnnotationId(highlightRects, containerRect, position)
      : null

    if (annotationMode) {
      // In annotation mode, double-tap on annotation selects it, otherwise creates/updates selection
      if (clickedId) {
        setSelection(null)
        const newAnnotationId = clickedId === selectedAnnotationId ? null : clickedId
        dispatch({
          type: 'ANNOTATION_SELECTED',
          payload: { annotationId: newAnnotationId },
        }).catch(console.error)
      } else if (newSelection) {
        // Clear annotation selection
        if (selectedAnnotationId) {
          dispatch({
            type: 'ANNOTATION_SELECTED',
            payload: { annotationId: null },
          }).catch(console.error)
        }
        setSelection(newSelection)
      }
      return
    }

    // Normal mode: don't enter annotation mode if verses are selected
    if (Object.keys(selectedVerses).length > 0) return

    // Don't enter annotation mode for interlinear versions (different DOM structure)
    if (version === 'INT' || version === 'INT_EN') return

    // Don't enter annotation mode in parallel verse mode
    if (isParallelVerseMode) return

    // Enter annotation mode
    dispatch({
      type: ENTER_ANNOTATION_MODE,
      payload: {},
    }).catch(console.error)

    // If double-tap is on an annotation, select it; otherwise create a selection on the word
    if (clickedId) {
      dispatch({
        type: 'ANNOTATION_SELECTED',
        payload: { annotationId: clickedId },
      }).catch(console.error)
    } else if (newSelection) {
      setSelection(newSelection)
    }
  }

  const handleLongPressVerse = (vKey: string) => {
    if (annotationMode) return // No long-press action in annotation mode
    if (isSelectionMode) return // No long-press in selection mode

    if (settings.press === 'shortPress') {
      dispatch({
        type: TOGGLE_SELECTED_VERSE,
        payload: vKey,
      }).catch(console.error)
    } else {
      const verse = versesMap.get(vKey)
      if (verse) {
        dispatch({
          type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
          params: { verse },
        }).catch(console.error)
      }
    }
  }

  // Check verses are selected (disables drag-to-annotation in normal mode)
  const hasSelectedVerses = Object.keys(selectedVerses).length > 0

  // Interlinear versions have different DOM structure, disable annotation mode
  const isInterlinearVersion = version === 'INT' || version === 'INT_EN'

  // Check if parallel verse mode (disables horizontal gestures for scroll)
  const isParallelVerseMode = Boolean(parallelVerses?.length)
  // Only disable swipe/drag in horizontal parallel mode (vertical mode has no horizontal scroll)
  const isHorizontalParallelMode = isParallelVerseMode && parallelDisplayMode === 'horizontal'

  // Annotation mode controller (handles touch selection and annotation events)
  useAnnotationModeController({
    containerRef,
    annotationMode,
    verses,
    dispatch,
    selection,
    setSelection,
    getTokens,
    highlightRects,
    selectionHandlePositions,
    selectedAnnotationId,
    // Disable drag-to-annotation in all parallel modes (annotation not supported)
    canDragToAnnotate: !hasSelectedVerses && !isInterlinearVersion && !isParallelVerseMode,
    triggers: {
      clearSelectionTrigger,
      applyAnnotationTrigger,
      eraseSelectionTrigger,
    },
    callbacks: {
      // Disable drag-to-annotation in all parallel modes
      onEnterAnnotationModeFromDrag: isParallelVerseMode
        ? undefined
        : () => {
            // Note: canDragToAnnotate already prevents this from being called when verses are selected
            dispatch({
              type: ENTER_ANNOTATION_MODE,
              payload: {},
            }).catch(console.error)
          },
      onTapVerse: handleTapVerse,
      onDoubleTapVerse: handleDoubleTapVerse,
      onLongPressVerse: handleLongPressVerse,
      onTouchedVerseChange: setTouchedVerseKey,
      onTapEmpty: () => {
        // In annotation mode, tapping on empty space clears selection
        if (annotationMode) {
          if (selectedAnnotationId) {
            dispatch({
              type: 'ANNOTATION_SELECTED',
              payload: { annotationId: null },
            }).catch(console.error)
          }
          if (selection) {
            setSelection(null)
          }
        }
      },
      // Disable swipe to change chapter in horizontal parallel mode (conflicts with horizontal scroll)
      onSwipe: isHorizontalParallelMode
        ? undefined
        : direction => {
            dispatch({
              type: direction === 'left' ? SWIPE_LEFT : SWIPE_RIGHT,
            }).catch(console.error)
          },
    },
  })

  useEffect(() => {
    dispatch({
      type: 'DOM_COMPONENT_MOUNTED',
    }).catch(console.error)
  }, [])
  // Sync horizontal scroll between header and content for parallel versions
  // Also calculate translateX for each title to make them "sticky" at the left edge
  useEffect(() => {
    // Only run when in parallel mode
    const hasParallelVersions = Boolean(parallelVerses?.length)
    if (!hasParallelVersions) return

    const headerEl = headerScrollRef.current
    if (!headerEl) return

    const columnWidthPx = window.innerWidth * (parallelColumnWidth / 100) // columnWidth vw in pixels

    let rafId: number | null = null

    const handleScroll = () => {
      const scrollLeft = document.documentElement.scrollLeft
      headerEl.scrollLeft = scrollLeft

      const titleRefs = headerEl.querySelectorAll('[data-version-title]')
      if (titleRefs.length === 0) return

      // Use RAF for smooth transform updates
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        titleRefs.forEach((titleEl, i) => {
          const columnStart = i * columnWidthPx
          const maxTranslate = columnWidthPx - 100 // Leave some margin for the title width

          // Calculate how much to translate to keep title at left edge
          let translateX = 0
          if (scrollLeft > columnStart) {
            translateX = Math.min(scrollLeft - columnStart - 10, maxTranslate)
          }

          ;(titleEl as HTMLElement).style.setProperty('--translate-x', `${translateX}px`)
        })
      })
    }

    // Initial call
    handleScroll()

    // Listen to scroll on document (HorizontalScrollWrapper doesn't fire scroll events)
    document.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      document.removeEventListener('scroll', handleScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [parallelVerses?.length, parallelColumnWidth])

  useEffect(() => {
    let lastScrollTop = 0
    let lastScrollTime = Date.now()
    const VELOCITY_THRESHOLD = 400
    let canSwipeDown = true
    let canSwipeUp = true
    let reachedBoundaries = false

    const handleScroll = () => {
      const currentScrollTop = window.scrollY
      const currentTime = Date.now()
      const timeDiff = currentTime - lastScrollTime
      const scrollDiff = currentScrollTop - lastScrollTop

      // Calculate velocity (pixels per millisecond)
      const velocity = Math.abs(scrollDiff / timeDiff)

      // Get total scrollable height
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight

      // Don't dispatch if scroll is beyond boundaries (iOS momentum scrolling)
      if (currentScrollTop < 0 || currentScrollTop > totalHeight) {
        if (!reachedBoundaries) {
          dispatch({
            type: SWIPE_UP,
          })
          document.documentElement.style.setProperty('--header-height', `${HEADER_HEIGHT}px`)
        }
        reachedBoundaries = true
        return
      }

      reachedBoundaries = false

      // Only trigger if velocity is above threshold
      if (velocity * 1000 > VELOCITY_THRESHOLD) {
        if (scrollDiff > 0 && canSwipeDown) {
          if (window.disableSwipeDownEvent) return
          dispatch({
            type: SWIPE_DOWN,
          })
          document.documentElement.style.setProperty('--header-height', `${HEADER_HEIGHT_MIN}px`)
          canSwipeDown = false
          canSwipeUp = true
        } else if (scrollDiff < 0 && canSwipeUp) {
          dispatch({
            type: SWIPE_UP,
          })
          document.documentElement.style.setProperty('--header-height', `${HEADER_HEIGHT}px`)
          canSwipeUp = false
          canSwipeDown = true
        }
      }

      lastScrollTop = currentScrollTop
      lastScrollTime = currentTime
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const hasVerses = verses.length > 0
  useEffect(() => {
    if (!hasVerses) return
    if (verseToScroll === 1) {
      window.scrollTo(0, 0)
    }
  }, [chapter, verseToScroll, hasVerses])

  useEffect(() => {
    if (!verseToScroll || !hasVerses) return

    if (verseToScroll === 1) return

    requestAnimationFrame(() => {
      const element = document.querySelector(`#verset-${verseToScroll}`)
      if (element) {
        window.disableSwipeDownEvent = true
        const elementPosition = element.getBoundingClientRect().top
        window.scrollTo({
          top: window.scrollY + elementPosition - 100,
        })
        setTimeout(() => {
          window.disableSwipeDownEvent = false
        }, 400)
      }
    })
  }, [verseToScroll, hasVerses])

  const navigateToPericope = () => {
    dispatch({
      type: NAVIGATE_TO_PERICOPE,
    })
  }

  const navigateToVersion = (version: string, index: number) => {
    dispatch({
      type: NAVIGATE_TO_VERSION,
      payload: { version, index },
    })
  }

  const isHebreu =
    version === 'BHS' ||
    ((version === 'INT' || version === 'INT_EN') && Number(verses[0].Livre) < 40)
  const introComment = comments?.[0]
  const isParallelVerse = Boolean(parallelVerses?.length)
  const parallelVersionTitles = isParallelVerse
    ? extractParallelVersionTitles(parallelVerses, version)
    : []

  return (
    <TranslationsProvider translations={translations}>
      <GlobalStyles />
      <DispatchProvider dispatch={dispatch}>
        <Container
          ref={containerRef}
          rtl={isHebreu}
          settings={settings}
          isParallelVerse={isParallelVerse}
        >
          {/* Highlight layer for word annotations and selection (disabled in parallel mode) */}
          {!isParallelVerse && (highlightRects.length > 0 || (annotationMode && selection)) && (
            <HighlightLayer $dimmed={!annotationMode && Object.keys(selectedVerses).length > 0}>
              {highlightRects.map(rect => (
                <HighlightRectDiv
                  key={rect.id}
                  $top={rect.top}
                  $left={rect.left}
                  $width={rect.width}
                  $height={rect.height}
                  $color={rect.color}
                  $annotationType={rect.annotationType}
                  $isSelected={rect.annotationId === selectedAnnotationId}
                  $primaryColor={settings.colors[settings.theme].primary}
                  $backgroundColor={settings.colors[settings.theme].reverse}
                  $animationDelay={rect.type === 'annotation' ? getAnimationDelay(rect.id) : 0}
                />
              ))}
              {/* Selection handles - only in annotation mode */}
              {annotationMode && (
                <SelectionHandles
                  hasSelection={selection !== null}
                  startPosition={selectionHandlePositions.start}
                  endPosition={selectionHandlePositions.end}
                />
              )}
            </HighlightLayer>
          )}
          {isParallelVerse && parallelDisplayMode === 'horizontal' && (
            <HeaderScrollWrapper ref={headerScrollRef} columnCount={parallelVersionTitles.length}>
              <VersionsContainer
                columnCount={parallelVersionTitles.length}
                columnWidth={parallelColumnWidth}
              >
                {parallelVersionTitles?.map((p, i) => (
                  <VersionTitleColumn
                    key={i}
                    columnCount={parallelVersionTitles.length}
                    columnWidth={parallelColumnWidth}
                  >
                    <VersionTitle
                      data-version-title={i}
                      onClick={() => navigateToVersion(p.id, i)}
                      style={{ paddingLeft: '5px' }}
                      settings={settings}
                    >
                      {p.id}
                      {p.error && (
                        <VersionErrorIndicator settings={settings}>⚠</VersionErrorIndicator>
                      )}
                      <ChevronDownIcon style={{ marginLeft: 4 }} />
                    </VersionTitle>
                  </VersionTitleColumn>
                ))}
              </VersionsContainer>
            </HeaderScrollWrapper>
          )}
          <HorizontalScrollWrapper
            ref={contentScrollRef}
            columnCount={
              isParallelVerse && parallelDisplayMode === 'horizontal'
                ? parallelVersionTitles.length
                : 1
            }
          >
            {(version === 'INT' || version === 'INT_EN') && !isParallelVerse && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
                <IntMode
                  settings={settings}
                  onClick={() => dispatch({ type: TOGGLE_INT_COMPLETE })}
                >
                  {isINTComplete
                    ? translations.interlinearDetailed
                    : translations.interlinearCompact}
                </IntMode>
              </div>
            )}
            {isHebreu && <RightDirection settings={settings}>Sens de la lecture ←</RightDirection>}
            {!!introComment && settings.commentsDisplay && (
              <Comment isIntro id="comment-0" settings={settings} comment={introComment} />
            )}

            {/* Unified verse rendering for all modes */}
            <UnifiedVersesRenderer
              verses={verses}
              parallelVerses={parallelVerses}
              focusVerses={focusVerses}
              secondaryVerses={secondaryVerses}
              selectedVerses={selectedVerses}
              highlightedVerses={highlightedVerses}
              settings={settings}
              verseToScroll={verseToScroll}
              isReadOnly={isReadOnly}
              version={version}
              pericopeChapter={pericopeChapter}
              isSelectionMode={isSelectionMode}
              selectedCode={selectedCode}
              isINTComplete={isINTComplete}
              isHebreu={isHebreu}
              isParallelVerse={isParallelVerse}
              comments={comments}
              wordAnnotations={wordAnnotations}
              wordAnnotationsInOtherVersions={wordAnnotationsInOtherVersions}
              taggedVerses={taggedVerses}
              bookmarkedVerses={bookmarkedVerses}
              notedVersesCount={notedVersesCount}
              notedVersesText={notedVersesText}
              linkedVersesCount={linkedVersesCount}
              linkedVersesText={linkedVersesText}
              studyRelationsCount={studyRelationsCount}
              versesWithAnnotationNotes={versesWithAnnotationNotes}
              navigateToPericope={navigateToPericope}
              annotationMode={annotationMode}
              touchedVerseKey={touchedVerseKey}
              taggedVersesInChapter={taggedVersesInChapter}
              versesWithNonHighlightTags={versesWithNonHighlightTags}
              columnCount={isParallelVerse ? parallelVersionTitles.length : 1}
              columnWidth={parallelColumnWidth}
              parallelDisplayMode={parallelDisplayMode}
              redWords={redWords}
            />
          </HorizontalScrollWrapper>
          {isReadOnly && focusVerses && focusVerses.length > 0 && (
            <ReadWholeChapterButtonContainer>
              <ReadWholeChapterButton
                settings={settings}
                onClick={() => {
                  const verseToScrollTo = focusVerses[0]
                  dispatch({ type: EXIT_READONLY_MODE })
                  setTimeout(() => {
                    const element = document.querySelector(`#verset-${verseToScrollTo}`)
                    if (element) {
                      const elementPosition = element.getBoundingClientRect().top
                      window.scrollTo({
                        top: window.scrollY + elementPosition - 100,
                      })
                    }
                    // Trigger highlight recalculation after layout change
                    window.dispatchEvent(new CustomEvent('layoutChanged'))
                  }, 400)
                }}
              >
                {translations.readWholeChapter}
              </ReadWholeChapterButton>
            </ReadWholeChapterButtonContainer>
          )}
          {!isReadOnly && focusVerses && focusVerses.length > 0 && (
            <ReadWholeChapterButtonContainer>
              <ReadWholeChapterButton
                settings={settings}
                onClick={() => {
                  dispatch({ type: ENTER_READONLY_MODE })
                  // Trigger highlight recalculation after layout change
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('layoutChanged'))
                  }, 100)
                }}
              >
                {translations.closeContext}
              </ReadWholeChapterButton>
            </ReadWholeChapterButtonContainer>
          )}
        </Container>
        <svg
          style={{
            visibility: 'hidden',
            position: 'absolute',
          }}
          width="0"
          height="0"
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
        >
          <defs>
            <filter id="goo">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 35 -4"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>
      </DispatchProvider>
    </TranslationsProvider>
  )
}

// ============================================================================
// MAIN VERSES RENDERER (lightweight shell)
// ============================================================================

const VersesRenderer = ({ settings, dispatch, translations, verses, ...rest }: Props) => {
  useFonts({
    'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
  })

  useEffect(() => {
    dispatch({
      type: 'DOM_COMPONENT_MOUNTED',
    }).catch(console.error)
    document.documentElement.style.setProperty('--header-height', `${HEADER_HEIGHT}px`)
    document.body.style.backgroundColor = settings.colors[settings.theme].reverse
  }, [])

  // Sync body background when theme changes
  useEffect(() => {
    if (settings?.theme) {
      document.body.style.backgroundColor = settings.colors[settings.theme].reverse
    }
  }, [settings?.theme])

  if (!verses.length) {
    return (
      <TranslationsProvider translations={translations}>
        <GlobalStyles />
        <DispatchProvider dispatch={dispatch}>
          <Container settings={settings} rtl={false} isParallelVerse={false} />
        </DispatchProvider>
      </TranslationsProvider>
    )
  }

  return (
    <LoadedBibleContent
      settings={settings}
      dispatch={dispatch}
      translations={translations}
      verses={verses}
      {...rest}
    />
  )
}

export default VersesRenderer
