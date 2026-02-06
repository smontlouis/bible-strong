'use dom'

import { setup, styled } from 'goober'
import { createGlobalStyles } from 'goober/global'
import React, { useEffect, useState, useRef } from 'react'
import { TagsObj, Verse as TVerse } from '~common/types'
import { HighlightsObj, NotesObj, LinksObj } from '~redux/modules/user'
import {
  Dispatch,
  LinkedVerse,
  NotedVerse,
  ParallelVerse,
  PericopeChapter,
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
  TOGGLE_SELECTED_VERSE,
} from './dispatch'
import { DispatchProvider } from './DispatchProvider'
import { TranslationsProvider, BibleDOMTranslations } from './TranslationsContext'
import './polyfills'
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
  'isFocused',
  'isParallel',
  'isParallelVerse',
  'isTouched',
  'isSelected',
  'isVerseToScroll',
  'highlightedColor',
  'rtl',
]
setup(React.createElement, undefined, undefined, (props: { [key: string]: any }) => {
  for (let prop in props) {
    if (forwardProps.includes(prop)) {
      delete props[prop]
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
  | 'notedVerses'
  | 'bookmarkedVerses'
  | 'linkedVerses'
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
  | 'comments'
  | 'redWords'
> & {
  dispatch: Dispatch
  dom: import('expo/dom').DOMProps
  translations: BibleDOMTranslations
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

const IntMode = styled('div')<RootStyles>(({ settings: { theme, colors } }) => ({
  textAlign: 'right',
  marginBottom: '20px',
  fontFamily: 'arial',
  fontSize: '13px',
  color: colors[theme].default,
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
const HeaderScrollWrapper = styled('div')<RootStyles & { columnCount: number }>(
  ({ settings: { theme, colors }, columnCount }) => ({
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
  })
)

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

// ============================================================================
// MAIN VERSES RENDERER
// ============================================================================

const VersesRenderer = ({
  verses,
  parallelVerses,
  parallelColumnWidth = 75,
  parallelDisplayMode = 'horizontal',
  focusVerses,
  secondaryVerses,
  comments: originalComments,
  selectedVerses,
  highlightedVerses,
  notedVerses,
  bookmarkedVerses,
  linkedVerses,
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
  clearAnnotationSelectionTrigger,
  selectedAnnotationId,
  safeAreaTop = 0,
  redWords,
}: Props) => {
  const [isINTComplete, setIsINTComplete] = useState(true)
  const [loaded, error] = useFonts({
    'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
  })

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

  const handleTapVerseAnnotationMode = (verseKey: string, position: { x: number; y: number }) => {
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    const clickX = position.x - containerRect.left
    const clickY = position.y - containerRect.top

    // Check if clicked on an annotation
    const clickedAnnotationRect = highlightRects.find(
      rect =>
        rect.type === 'annotation' &&
        rect.annotationId &&
        clickX >= rect.left &&
        clickX <= rect.left + rect.width &&
        clickY >= rect.top &&
        clickY <= rect.top + rect.height
    )

    if (clickedAnnotationRect?.annotationId) {
      setSelection(null)
      const newAnnotationId =
        clickedAnnotationRect.annotationId === selectedAnnotationId
          ? null
          : clickedAnnotationRect.annotationId
      dispatch({
        type: 'ANNOTATION_SELECTED',
        payload: { annotationId: newAnnotationId },
      }).catch(console.error)
      return
    }

    // Check if clicked inside current selection
    const clickedInsideSelection = highlightRects.some(
      rect =>
        rect.type === 'selection' &&
        clickX >= rect.left &&
        clickX <= rect.left + rect.width &&
        clickY >= rect.top &&
        clickY <= rect.top + rect.height
    )

    if (clickedInsideSelection) {
      return // Don't clear selection if clicking inside it
    }

    // Clear annotation selection if any
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

    // No selection exists → create one on the clicked word
    const verse = verses.find(v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === verseKey)
    if (!verse) return

    const tokens = getTokens(verseKey, verse.Texte)
    const caretInfo = getCaretInfoFromPoint(position.x, position.y)
    if (!caretInfo) return

    const wordIndex = getWordIndexFromCharOffset(tokens, caretInfo.charOffset)
    if (wordIndex === null) return

    setSelection({
      start: { verseKey, wordIndex },
      end: { verseKey, wordIndex },
    })
  }

  const handleTapVerseSelectionMode = (verseKey: string) => {
    if (isSelectionMode?.includes('verse')) {
      dispatch({
        type: TOGGLE_SELECTED_VERSE,
        payload: verseKey,
      }).catch(console.error)
      return
    }

    if (isSelectionMode?.includes('strong')) {
      const verse = verses.find(v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === verseKey)
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

  const handleTapVerseNormalMode = (verseKey: string) => {
    const isSelectedMode = Boolean(Object.keys(selectedVerses).length)
    if (isSelectedMode || settings.press === 'longPress') {
      dispatch({
        type: TOGGLE_SELECTED_VERSE,
        payload: verseKey,
      }).catch(console.error)
    } else {
      const verse = verses.find(v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === verseKey)
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

  const handleDoubleTapVerse = (verseKey: string, position: { x: number; y: number }) => {
    // Find the word at the double-tap position
    const verse = verses.find(v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === verseKey)
    if (!verse) return

    const tokens = getTokens(verseKey, verse.Texte)
    const caretInfo = getCaretInfoFromPoint(position.x, position.y)

    let newSelection: SelectionRange | null = null
    if (caretInfo) {
      const wordIndex = getWordIndexFromCharOffset(tokens, caretInfo.charOffset)
      if (wordIndex !== null) {
        newSelection = {
          start: { verseKey, wordIndex },
          end: { verseKey, wordIndex },
        }
      }
    }

    // Check if double-tap is on an existing annotation
    const containerRect = containerRef.current?.getBoundingClientRect()
    let clickedAnnotationId: string | null = null
    if (containerRect) {
      const clickX = position.x - containerRect.left
      const clickY = position.y - containerRect.top
      const clickedAnnotationRect = highlightRects.find(
        rect =>
          rect.type === 'annotation' &&
          rect.annotationId &&
          clickX >= rect.left &&
          clickX <= rect.left + rect.width &&
          clickY >= rect.top &&
          clickY <= rect.top + rect.height
      )
      if (clickedAnnotationRect?.annotationId) {
        clickedAnnotationId = clickedAnnotationRect.annotationId
      }
    }

    if (annotationMode) {
      // In annotation mode, double-tap on annotation selects it, otherwise creates/updates selection
      if (clickedAnnotationId) {
        setSelection(null)
        const newAnnotationId =
          clickedAnnotationId === selectedAnnotationId ? null : clickedAnnotationId
        dispatch({
          type: 'ANNOTATION_SELECTED',
          payload: { annotationId: newAnnotationId },
        }).catch(console.error)
      } else if (newSelection) {
        // Clear annotation selection if any
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
    if (clickedAnnotationId) {
      dispatch({
        type: 'ANNOTATION_SELECTED',
        payload: { annotationId: clickedAnnotationId },
      }).catch(console.error)
    } else if (newSelection) {
      setSelection(newSelection)
    }
  }

  const handleLongPressVerse = (verseKey: string) => {
    if (annotationMode) return // No long-press action in annotation mode
    if (isSelectionMode) return // No long-press in selection mode

    if (settings.press === 'shortPress') {
      dispatch({
        type: TOGGLE_SELECTED_VERSE,
        payload: verseKey,
      }).catch(console.error)
    } else {
      const verse = verses.find(v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === verseKey)
      if (verse) {
        dispatch({
          type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
          params: { verse },
        }).catch(console.error)
      }
    }
  }

  // Check if any verses are selected (disables drag-to-annotation in normal mode)
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
    console.log('[Bible] WEB: DOM component mounted')
    dispatch({
      type: 'DOM_COMPONENT_MOUNTED',
    }).catch(console.error)

    // Set initial header height CSS variable
    document.documentElement.style.setProperty('--header-height', `${HEADER_HEIGHT}px`)
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
    if (settings?.theme) {
      document.body.style.backgroundColor = settings.colors[settings.theme].reverse
    }
  }, [settings?.theme])

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

  const sortVersesToTags = (highlightedVerses: HighlightsObj): TaggedVerse[] | null => {
    if (!highlightedVerses) return null
    const p = highlightedVerses
    const taggedVerses = Object.keys(p).reduce(
      (
        arr: {
          date: number
          color: string
          verseIds: any[]
          tags: TagsObj
        }[],
        verse,
        i
      ) => {
        const [Livre, Chapitre, Verset] = verse.split('-').map(Number)
        const formattedVerse = { Livre, Chapitre, Verset, Texte: '' }

        if (!arr.find(a => a.date === p[verse].date)) {
          arr.push({
            date: p[verse].date,
            color: p[verse].color,
            verseIds: [],
            tags: {},
          })
        }

        const dateInArray = arr.find(a => a.date === p[verse].date)
        if (dateInArray) {
          dateInArray.verseIds.push(verse)
          dateInArray.verseIds.sort((a, b) => Number(a.Verset) - Number(b.Verset))
          dateInArray.tags = { ...dateInArray.tags, ...p[verse].tags }
        }

        arr.sort((a, b) => Number(b.date) - Number(a.date))

        return arr
      },
      []
    )

    return taggedVerses.map(verse => ({
      ...verse,
      lastVerse: verse.verseIds[verse.verseIds.length - 1],
      tags: Object.values(verse.tags),
    }))
  }

  interface AnnotationNotesInfo {
    versesWithAnnotationNotes: Set<string>
    annotationNotesCountByVerse: { [key: string]: number }
  }

  const getAnnotationNotesInfo = (
    verses: TVerse[],
    wordAnnotations: WebViewProps['wordAnnotations'],
    version: string
  ): AnnotationNotesInfo => {
    const versesWithAnnotationNotes = new Set<string>()
    const annotationNotesCountByVerse: { [key: string]: number } = {}

    if (!verses?.length || !wordAnnotations) {
      return { versesWithAnnotationNotes, annotationNotesCountByVerse }
    }

    const { Livre, Chapitre } = verses[0]

    Object.values(wordAnnotations).forEach(annotation => {
      if (annotation.version !== version || !annotation.noteId) return

      annotation.ranges.forEach(range => {
        const [bookStr, chapterStr, verseStr] = range.verseKey.split('-')
        if (parseInt(bookStr) === Livre && parseInt(chapterStr) === Chapitre) {
          versesWithAnnotationNotes.add(verseStr)
          annotationNotesCountByVerse[verseStr] = (annotationNotesCountByVerse[verseStr] || 0) + 1
        }
      })
    })

    return { versesWithAnnotationNotes, annotationNotesCountByVerse }
  }

  const getNotedVersesCount = (
    verses: TVerse[],
    notedVerses: NotesObj,
    annotationNotesCountByVerse: { [key: string]: number }
  ) => {
    const newNotedVerses: { [key: string]: number } = {}
    if (!verses?.length) return newNotedVerses

    const { Livre, Chapitre } = verses[0]

    // Count classic verse notes
    Object.keys(notedVerses).forEach(key => {
      // Ignore annotation notes (counted separately)
      if (key.startsWith('annotation:')) return

      const firstVerseRef = key.split('/')[0]
      const [bookStr, chapterStr, verseStr] = firstVerseRef.split('-')
      const bookNumber = parseInt(bookStr)
      const chapterNumber = parseInt(chapterStr)

      if (bookNumber === Livre && chapterNumber === Chapitre) {
        newNotedVerses[verseStr] = (newNotedVerses[verseStr] || 0) + 1
      }
    })

    // Add annotation notes (already calculated)
    Object.entries(annotationNotesCountByVerse).forEach(([verseStr, count]) => {
      newNotedVerses[verseStr] = (newNotedVerses[verseStr] || 0) + count
    })

    return newNotedVerses
  }

  const getNotedVersesText = (verses: TVerse[], notedVerses: NotesObj) => {
    const newNotedVerses: {
      [key: string]: NotedVerse[]
    } = {}

    if (verses?.length) {
      const { Livre, Chapitre } = verses[0]
      Object.entries(notedVerses).map(([key, value]) => {
        const versesInArray = key.split('/')

        const lastVerseRef = versesInArray[versesInArray.length - 1]
        const bookNumber = parseInt(lastVerseRef.split('-')[0])
        const chapterNumber = parseInt(lastVerseRef.split('-')[1])
        const verseNumber = lastVerseRef.split('-')[2]

        if (bookNumber === Livre && chapterNumber === Chapitre) {
          const verseToPush = {
            key,
            verses:
              versesInArray.length > 1
                ? `${versesInArray[0].split('-')[2]}-${
                    versesInArray[versesInArray.length - 1].split('-')[2]
                  }`
                : versesInArray[0].split('-')[2],
            ...value,
          }
          if (newNotedVerses[verseNumber]) {
            newNotedVerses[verseNumber].push(verseToPush)
          } else {
            newNotedVerses[verseNumber] = [verseToPush]
          }
        }
      })
    }
    return newNotedVerses
  }

  const getLinkedVersesCount = (verses: TVerse[], linkedVerses: LinksObj | undefined) => {
    const newLinkedVerses: { [key: string]: number } = {}
    if (verses?.length && linkedVerses) {
      const { Livre, Chapitre } = verses[0]
      Object.keys(linkedVerses).map(key => {
        const firstVerseRef = key.split('/')[0]
        const bookNumber = parseInt(firstVerseRef.split('-')[0])
        const chapterNumber = parseInt(firstVerseRef.split('-')[1])
        const verseNumber = firstVerseRef.split('-')[2]
        if (bookNumber === Livre && chapterNumber === Chapitre) {
          if (newLinkedVerses[verseNumber])
            newLinkedVerses[verseNumber] = newLinkedVerses[verseNumber] + 1
          else newLinkedVerses[verseNumber] = 1
        }
      })
    }
    return newLinkedVerses
  }

  const getLinkedVersesText = (verses: TVerse[], linkedVerses: LinksObj | undefined) => {
    const newLinkedVerses: {
      [key: string]: LinkedVerse[]
    } = {}

    if (verses?.length && linkedVerses) {
      const { Livre, Chapitre } = verses[0]
      Object.entries(linkedVerses).map(([key, value]) => {
        const versesInArray = key.split('/')

        const lastVerseRef = versesInArray[versesInArray.length - 1]
        const bookNumber = parseInt(lastVerseRef.split('-')[0])
        const chapterNumber = parseInt(lastVerseRef.split('-')[1])
        const verseNumber = lastVerseRef.split('-')[2]

        if (bookNumber === Livre && chapterNumber === Chapitre) {
          const formattedUrl = value.url?.replace(/^https?:\/\//, '')
          const title = value.customTitle || value.ogData?.title || formattedUrl
          const verseToPush: LinkedVerse = {
            key,
            verses:
              versesInArray.length > 1
                ? `${versesInArray[0].split('-')[2]}-${
                    versesInArray[versesInArray.length - 1].split('-')[2]
                  }`
                : versesInArray[0].split('-')[2],
            url: value.url,
            title,
            linkType: value.linkType || 'website',
            date: value.date,
            tags: value.tags,
          }
          if (newLinkedVerses[verseNumber]) {
            newLinkedVerses[verseNumber].push(verseToPush)
          } else {
            newLinkedVerses[verseNumber] = [verseToPush]
          }
        }
      })
    }
    return newLinkedVerses
  }

  const transformComments = (comments: { [key: string]: string } | null, versesLength: number) => {
    if (!comments) return null

    return Object.entries(comments).reduce(
      (acc, [key, value], i) => {
        if (key === '0') {
          return { ...acc, [key]: value }
        }

        if (Object.entries(comments)[i + 1]) {
          const newKey = Number(Object.keys(comments)[i + 1]) - 1
          return { ...acc, [newKey]: value }
        }
        return { ...acc, [versesLength]: value }
      },
      {} as { [key: string]: string }
    )
  }

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

  const comments = transformComments(originalComments, verses.length)

  const isHebreu =
    version === 'BHS' ||
    ((version === 'INT' || version === 'INT_EN') && Number(verses[0].Livre) < 40)
  const introComment = comments?.[0]
  const isParallelVerse = Boolean(parallelVerses?.length)
  const parallelVersionTitles = isParallelVerse
    ? extractParallelVersionTitles(parallelVerses, version)
    : []

  const taggedVerses = sortVersesToTags(highlightedVerses)
  const { versesWithAnnotationNotes, annotationNotesCountByVerse } = getAnnotationNotesInfo(
    verses,
    wordAnnotations,
    version
  )
  const notedVersesCount = getNotedVersesCount(verses, notedVerses, annotationNotesCountByVerse)
  const notedVersesText = getNotedVersesText(verses, notedVerses)
  const linkedVersesCount = getLinkedVersesCount(verses, linkedVerses)
  const linkedVersesText = getLinkedVersesText(verses, linkedVerses)

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
            <HeaderScrollWrapper
              ref={headerScrollRef}
              settings={settings}
              columnCount={parallelVersionTitles.length}
            >
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
            columnCount={isParallelVerse && parallelDisplayMode === 'horizontal' ? parallelVersionTitles.length : 1}
          >
            {(version === 'INT' || version === 'INT_EN') && (
              <IntMode settings={settings} onClick={() => setIsINTComplete(!isINTComplete)}>
                {isINTComplete ? 'Mode 1' : 'Mode 2'}
              </IntMode>
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

export default VersesRenderer
