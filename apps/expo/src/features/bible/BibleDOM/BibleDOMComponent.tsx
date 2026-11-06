'use dom'

import './arrayAtPolyfill'
import { getPassageContextHeaderHeight } from '../passagePreviewPresentation'
import EntityChipsDOM from '~common/EntityChipsDOM'
import type { EntityChip } from '~common/entityChips'
import {
  READING_TEXT_MAX_WIDTH,
  BIBLE_READING_HORIZONTAL_PADDING,
  BIBLE_HEADER_PILL_INSET,
  PARALLEL_COLUMN_GAP,
  getParallelColumnsWidth,
} from '~common/readingLayout'
import { getParallelColumnFontSizeScale } from './verseTypography'
import { setup, styled, keyframes } from 'goober'
import { createGlobalStyles } from 'goober/global'
import { m, useReducedMotion } from 'motion/react'
import Feather from '@expo/vector-icons/Feather'
import { domMax, LazyMotion } from 'motion/react'
import React, { useEffect, useEffectEvent, useMemo, useState, useRef } from 'react'
import { Verse as TVerse } from '~common/types'
import { floatingShadow, radii } from '~common/ui/surfaces'
import {
  BibleDOMDownloadState,
  ParallelVerse,
  RootStyles,
  TaggedVerse,
  VerseRelationItem,
  WebViewProps,
} from './BibleDOMWrapper'
import { BibleError } from '~helpers/bibleErrors'
import { getBibleDOMErrorPresentation } from './bibleDOMErrorPresentation'
import VersionChip from './VersionChip'
import type { ReaderPageSignalHandler } from '../readerIntent/types'
import { ReaderIntentProvider, useReaderIntent, useReaderPageSignal } from './useReaderIntent'
import { OverlayCloseRequestProvider } from './overlayLifecycle'
import { TranslationsProvider, BibleDOMTranslations } from './TranslationsContext'
import { scaleFontSize } from './scaleFontSize'
import { useFonts } from 'expo-font'
import {
  BIBLE_FORM_SHEET_HEADER_HEIGHT,
  HEADER_HEIGHT,
  HEADER_HEIGHT_MIN,
} from '~features/app-switcher/utils/constants'
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
import type { VerseTarget } from './AnnotationMode/verseTargets'
import { useOptimisticVerseSelection } from './optimisticVerseSelection'
import { getVerseSelectionBlocks } from './verseSelectionBlocks'
// Unified verse renderer
import { UnifiedVersesRenderer } from './UnifiedVersesRenderer'
import AnnotationInlineItems from './AnnotationInlineItems'
import { withColorAlpha } from './themeOverlayColor'
import { getScrollTargetVerse } from './verseRenderingModel'
import { shouldSuppressVerseGestures } from '~helpers/interlinearDisplayMode'
import ChapterEntities from './ChapterEntities'
import FocusVerseStudy from './FocusVerseStudy'
import ReadingPositionKeeper from './ReadingPositionKeeper'
import ChapterOpening from './ChapterOpening'
import { getOverlayLayoutTransition } from './overlayStagger'
import PlanDayStepCard, { type PlanDayStepView } from './PlanDayStepCard'
import PassageMediaThumbnails from './PassageMediaThumbnails'
import { getPassageMediaGalleryItems, getPassageMediaGallerySections } from './passageMediaGallery'
import { createVersePositionLayoutProps } from './annotationLayoutLifecycle'
import {
  addDOMScrollListener,
  getDOMScrollHeight,
  getDOMScrollTarget,
  getDOMScrollTop,
  getDOMViewportHeight,
  scrollDOMTo,
} from './domScroll'

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
  'fadePosition',
  'isButton',
  'isDisabled',
  'columnCount',
  'columnWidth',
  'rtl',
  'headerHeight',
  '$secondary',
  '$progress',
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

  .chapter-entity-button {
    -webkit-tap-highlight-color: transparent;
  }

  .chapter-entity-button:active {
    opacity: 0.6;
  }

  @keyframes chapter-entity-spin {
    to { transform: rotate(360deg); }
  }

  .chapter-entity-loader {
    display: inline-flex;
    animation: chapter-entity-spin 900ms linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .chapter-entity-loader {
      animation: none;
    }
  }
` as React.FC

type Props = Pick<
  WebViewProps,
  | 'tabId'
  | 'onReaderIntent'
  | 'verses'
  | 'parallelVerses'
  | 'parallelColumnWidth'
  | 'parallelDisplayMode'
  | 'columnTextModeControls'
  | 'focusVerses'
  | 'selectedVerses'
  | 'selectedVersesVersion'
  | 'highlightedVerses'
  | 'bookmarkedVerses'
  | 'wordAnnotations'
  | 'wordAnnotationsInOtherVersions'
  | 'taggedVersesInChapter'
  | 'versesWithNonHighlightTags'
  | 'settings'
  | 'verseToScroll'
  | 'verseNavigationRequest'
  | 'contextDisplayMode'
  | 'version'
  | 'interlinearMode'
  | 'pericopeChapter'
  | 'passageMedia'
  | 'book'
  | 'chapter'
  | 'isSelectionMode'
  | 'selectedCode'
  | 'redWords'
  | 'parallelRedWords'
  | 'parallelPericopeChapters'
  | 'inlineCommentaries'
  | 'chapterEntities'
  | 'chapterEntitiesLoaded'
  | 'chapterEntityPortraits'
  | 'focusStudy'
  | 'focusStudyTranslations'
  | 'chapterEntityModuleStatus'
  | 'chapterEntityDownloadState'
> & {
  focusedMetadataItems?: EntityChip[]
  onFocusedMetadataPress?: (type: EntityChip['type'], id: string) => Promise<void>
  /** What the page tells of itself: mounted, an overlay open, a message (ADR-0098). */
  onPageSignal: ReaderPageSignalHandler
  dom: import('expo/dom').DOMProps
  translations: BibleDOMTranslations
  chapterEntityTranslations: {
    title: string
    groups: { person: string; place: string; group: string; supernatural: string; other: string }
    openEntity: string
    openMap: string
    empty: string
    downloadTitle: string
    downloadDescription: string
    downloading: string
    downloadFailed: string
    dismiss: string
  }
  // Pre-computed metadata from native side
  taggedVerses: TaggedVerse[] | null
  versesWithAnnotationNotes: Record<string, boolean>
  annotationNotesCountByVerse: { [key: string]: number }
  relationItemsCount: { [key: string]: number }
  relationItemsText: { [key: string]: VerseRelationItem[] }
  annotationRelationItems: Record<string, VerseRelationItem[]>
  inPlan?: boolean
  planDayStep?: PlanDayStepView
  // Annotation mode props (uncontrolled - DOM manages local annotation state)
  annotationMode?: boolean
  clearSelectionTrigger?: number
  applyAnnotationTrigger?: { count: number; color: string; type: AnnotationType }
  eraseSelectionTrigger?: number
  clearAnnotationSelectionTrigger?: number
  /** Bumped by the application to close the overlay open on the page (Android back). */
  closeOverlayTrigger?: number
  selectedAnnotationId?: string | null
  // Safe area inset from native side (CSS env vars don't work in Expo DOM WebView)
  safeAreaTop?: number
  isFormSheet?: boolean
  keepControlsVisible?: boolean
  error?: BibleError | null
  errorDownloadState?: BibleDOMDownloadState
  isResettingDatabase?: boolean
  isConnected: boolean
  onlineOnly?: boolean
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

const RETURN_TO_SELECTED_VERSE_BOTTOM_OFFSET = 250
// The room a version title leaves at the end of its column before the next title
const TITLE_EDGE_MARGIN = 10
// The chapter footer and the tab bar drawn over the bottom of the reader, hidden in full screen
const READER_FOOTER_OVERLAY_HEIGHT = 100

const setReaderFooterHeight = (isVisible: boolean) => {
  document.documentElement.style.setProperty(
    '--footer-height',
    `${isVisible ? READER_FOOTER_OVERLAY_HEIGHT : 0}px`
  )
}

const Container = styled('div')<
  RootStyles & {
    rtl: boolean
    isParallelVerse: boolean
    headerHeight: number
    $columnsScrollScope?: boolean
    $scrollsColumns?: boolean
  }
>(
  ({
    settings: { alignContent, theme, colors },
    rtl,
    isParallelVerse,
    headerHeight,
    $columnsScrollScope,
    $scrollsColumns,
  }) => ({
    // The version titles, outside the columns' scroller, read its scroll timeline
    ...($columnsScrollScope ? { timelineScope: COLUMNS_SCROLL_TIMELINE } : {}),
    position: 'relative', // For highlight layer positioning
    width: '100%',
    minWidth: 0,
    maxWidth: isParallelVerse
      ? 'none'
      : `${READING_TEXT_MAX_WIDTH + BIBLE_READING_HORIZONTAL_PADDING * 2}px`,
    boxSizing: 'border-box',
    margin: '0 auto',
    padding: '10px 15px',
    // Scrolled columns keep their margin inside their scroller and run to the screen edges
    ...($scrollsColumns ? { paddingInline: 0 } : {}),
    paddingBottom: '300px',
    textAlign: alignContent,
    background: colors[theme].reverse,
    color: colors[theme].default,
    direction: rtl ? 'rtl' : 'ltr',
    paddingTop: `${headerHeight + 10}px`,
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

const ReturnToSelectedVerseButton = styled('button')<
  RootStyles & { $position: 'top' | 'bottom' | null }
>(({ settings: { theme, colors, fontFamily }, $position }) => {
  const isVisible = Boolean($position)

  return {
    position: 'fixed',
    left: '50%',
    top: $position === 'top' ? `${HEADER_HEIGHT + 12}px` : undefined,
    bottom: $position === 'bottom' ? `${RETURN_TO_SELECTED_VERSE_BOTTOM_OFFSET + 16}px` : undefined,
    transform: `translateX(-50%) scale(${isVisible ? 1 : 0.95})`,
    opacity: isVisible ? 1 : 0,
    pointerEvents: isVisible ? 'auto' : 'none',
    zIndex: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    borderRadius: '999px',
    border: 0,
    // Floats above the text: the raised surface and the app's one floating shadow
    background: colors[theme].surfaceRaised,
    color: colors[theme].primary,
    ...floatingShadow,
    fontFamily,
    fontSize: '22px',
    lineHeight: '22px',
    cursor: 'pointer',
    transition: 'opacity 180ms ease, transform 180ms ease',
  }
})

const ErrorContainer = styled('div')<RootStyles & { headerHeight: number }>(
  ({ settings: { theme, colors, fontFamily }, headerHeight }) => ({
    position: 'fixed',
    inset: 0,
    height: '100vh',
    width: '100vw',
    boxSizing: 'border-box',
    overflow: 'hidden',
    padding: `${headerHeight + 200}px 24px 24px`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: colors[theme].reverse,
    color: colors[theme].default,
    fontFamily,
    textAlign: 'center',
  })
)

const ErrorContent = styled('div')({
  width: 'calc(100vw - 48px)',
  maxWidth: '360px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
})

const ErrorIcon = styled('div')<RootStyles>(({ settings: { theme, colors } }) => ({
  width: '56px',
  height: '56px',
  borderRadius: '999px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: colors[theme].lightGrey,
  color: colors[theme].primary,
}))

const ErrorMessage = styled('p')<RootStyles>(
  ({ settings: { fontSizeScale, fontFamily, colors, theme } }) => ({
    margin: 0,
    fontFamily,
    fontSize: scaleFontSize(16, fontSizeScale),
    lineHeight: 1.35,
    color: colors[theme].default,
  })
)

const ErrorButton = styled('button')<RootStyles & { $secondary?: boolean }>(
  ({ settings: { theme, colors, fontFamily }, $secondary }) => ({
    minHeight: '44px',
    padding: '0 18px',
    borderRadius: `${radii.pill}px`,
    border: 0,
    // As the app's buttons: the secondary one is a neutral tint, not an outline
    background: $secondary ? withColorAlpha(colors[theme].default, 0.07) : colors[theme].primary,
    color: $secondary ? colors[theme].default : colors[theme].reverse,
    fontFamily,
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
  })
)

const ProgressTrack = styled('div')<RootStyles>(({ settings: { theme, colors } }) => ({
  width: '180px',
  height: '6px',
  borderRadius: '999px',
  overflow: 'hidden',
  background: colors[theme].lightGrey,
}))

const ProgressBar = styled('div')<RootStyles & { $progress: number }>(
  ({ settings: { theme, colors }, $progress }) => ({
    width: `${Math.max(0, Math.min(1, $progress)) * 100}%`,
    height: '100%',
    background: colors[theme].primary,
    transition: 'width 180ms ease',
  })
)

// Horizontal parallel display: the version titles follow the columns through a scroll timeline
// of the columns' scroller, run by the browser with the scroll itself. Without it, the header
// is scrolled from JavaScript, a frame or more behind.
const COLUMNS_SCROLL_TIMELINE = '--bible-columns'

const canFollowColumnsScroll = () =>
  typeof CSS !== 'undefined' &&
  CSS.supports('animation-timeline', COLUMNS_SCROLL_TIMELINE) &&
  CSS.supports('timeline-scope', COLUMNS_SCROLL_TIMELINE) &&
  CSS.supports('animation-range', '0px 1px')

// A range far beyond any scroll width: over it, the translation equals the scroll offset.
const COLUMNS_SCROLL_RANGE = 100000

const followColumnsScroll = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(-${COLUMNS_SCROLL_RANGE}px); }
`

// A title keeps to the left edge while its column passes, by the distance its column leaves it.
const keepTitleAtLeftEdge = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(var(--title-travel, 0px)); }
`

// A column's title: its version chip, kept to the left edge while its column passes
const VersionTitleGroup = styled('div')<{ $followsScroll?: boolean }>(({ $followsScroll }) => ({
  position: 'sticky',
  left: 0,
  display: 'inline-flex',
  ...($followsScroll
    ? {
        animation: `${keepTitleAtLeftEdge} linear both`,
        animationTimeline: COLUMNS_SCROLL_TIMELINE,
        animationRange: 'var(--title-range-start, 0px) var(--title-range-end, 0px)',
      }
    : {}),
}))

const VersionsContainer = styled('div')<{
  columnCount: number
  columnWidth: number
  $followsScroll?: boolean
}>(({ columnCount, columnWidth, $followsScroll }) => ({
  position: 'relative',
  display: 'flex',
  paddingTop: '5px',
  paddingBottom: '10px',
  // The width of the columns below, centred above them as they are
  width: columnCount > 1 ? getParallelColumnsWidth(columnCount, columnWidth) : '100%',
  minWidth: columnCount > 1 ? getParallelColumnsWidth(columnCount, columnWidth) : '100%',
  marginInline: 'auto',
  transition: 'width 0.4s ease-in-out',
  ...($followsScroll
    ? {
        animation: `${followColumnsScroll} linear both`,
        animationTimeline: COLUMNS_SCROLL_TIMELINE,
        animationRange: `0px ${COLUMNS_SCROLL_RANGE}px`,
      }
    : {}),
}))

// The columns, centred while they leave room on the screen. Wider, they start at the scroller's
// edge: the block keeps to the scroller's width and the rows overflow it into the scroll.
const ColumnsBlock = styled('div')<{ $columnsWidth?: string }>(({ $columnsWidth }) =>
  $columnsWidth ? { width: $columnsWidth, maxWidth: '100%', marginInline: 'auto' } : {}
)

// Wrapper pour le scroll horizontal (content)
const HorizontalScrollWrapper = styled('div')<{
  columnCount: number
  $panYOnly?: boolean
  $scrollTimeline?: boolean
  $scrollsColumns?: boolean
}>(({ columnCount, $panYOnly, $scrollTimeline, $scrollsColumns }) => ({
  overflowX: columnCount > 1 ? 'auto' : 'visible',
  paddingInline: $scrollsColumns ? `${BIBLE_READING_HORIZONTAL_PADDING}px` : undefined,
  ...($scrollTimeline ? { scrollTimeline: `${COLUMNS_SCROLL_TIMELINE} x` } : {}),
  // Annotation mode: horizontal moves belong to word selection, the reader scrolls the columns
  touchAction: $panYOnly ? 'pan-y' : undefined,
  scrollBehavior: 'smooth',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
  '@media (min-width: 768px)': {
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(0, 0, 0, 0.3) transparent',
    '&::-webkit-scrollbar': { display: 'block', height: '6px' },
  },
}))

// Wrapper pour le header avec scroll synchronisé (pas de scrollbar visible)
const HeaderScrollWrapper = styled('div')<{ columnCount: number; $followsScroll?: boolean }>(
  ({ columnCount, $followsScroll }) => ({
    position: 'sticky',
    // The version pills line up under the header's pill, as the text does in single reading
    paddingInlineStart: `${BIBLE_HEADER_PILL_INSET}px`,
    // As wide inside as the columns' scroller, so the centred titles keep that offset
    paddingInlineEnd: `${BIBLE_READING_HORIZONTAL_PADDING * 2 - BIBLE_HEADER_PILL_INSET}px`,
    top: 'var(--header-height)',
    zIndex: 2,
    transition: 'top 0.3s cubic-bezier(.13,.69,.5,.98)',
    // Following the scroll timeline, the titles move themselves: the header no longer scrolls
    overflowX: $followsScroll ? 'hidden' : columnCount > 1 ? 'auto' : 'visible',
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
// Distance from one horizontal parallel column to the next
const getParallelColumnPitch = (columnWidth: number) =>
  window.innerWidth * (columnWidth / 100) - PARALLEL_COLUMN_GAP

const VersionTitleColumn = styled('div')<{ columnCount: number; columnWidth: number }>(
  ({ columnCount, columnWidth }) => ({
    // The width of the columns below, which leave out the gap the next one opens with
    width: columnCount > 1 ? `calc(${columnWidth}vw - ${PARALLEL_COLUMN_GAP}px)` : '100%',
    minWidth: columnCount > 1 ? `calc(${columnWidth}vw - ${PARALLEL_COLUMN_GAP}px)` : '100%',
    transition: 'width 0.4s ease-in-out',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
  })
)

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

// The layout props read the verses' transform only during a layout animation, but React
// Compiler sees a ref captured during render and would skip the whole chapter: they are built
// here, in a hook of their own, once per mount.
const useVersePositionLayoutProps = (
  versesContentRef: React.RefObject<HTMLDivElement | null>,
  setIsAnimating: (isAnimating: boolean) => void
) => {
  const [props] = useState(() =>
    createVersePositionLayoutProps({
      getTransform: () => versesContentRef.current?.style.transform,
      onAnimationStart: () => setIsAnimating(true),
      onAnimationSettled: () => setIsAnimating(false),
    })
  )
  return props
}

// ============================================================================
// LOADED BIBLE CONTENT (heavy component, only rendered when verses are available)
// ============================================================================

const LoadedBibleContent = ({
  focusedMetadataItems = [],
  onFocusedMetadataPress,
  verses,
  parallelVerses,
  parallelColumnWidth: preferredColumnWidth = 75,
  parallelDisplayMode = 'horizontal',
  columnTextModeControls,
  focusVerses,
  selectedVerses,
  selectedVersesVersion,
  highlightedVerses,
  bookmarkedVerses,
  wordAnnotations,
  wordAnnotationsInOtherVersions,
  taggedVersesInChapter,
  versesWithNonHighlightTags,
  settings,
  verseToScroll,
  verseNavigationRequest,
  contextDisplayMode,
  version,
  interlinearMode,
  pericopeChapter,
  passageMedia,
  book,
  chapter,
  isSelectionMode,
  selectedCode,
  translations,
  inlineCommentaries,
  chapterEntities,
  chapterEntitiesLoaded,
  chapterEntityPortraits,
  focusStudy,
  focusStudyTranslations,
  chapterEntityModuleStatus,
  chapterEntityDownloadState,
  chapterEntityTranslations,
  inPlan,
  planDayStep,
  annotationMode,
  clearSelectionTrigger,
  applyAnnotationTrigger,
  eraseSelectionTrigger,
  selectedAnnotationId,
  redWords,
  parallelRedWords,
  parallelPericopeChapters,
  // Pre-computed metadata from native side
  taggedVerses,
  versesWithAnnotationNotes,
  annotationNotesCountByVerse,
  relationItemsCount,
  relationItemsText,
  annotationRelationItems,
  isFormSheet,
  keepControlsVisible = false,
}: Props) => {
  // Ref for highlight layer
  const containerRef = useRef<HTMLDivElement>(null)
  // The whole width of the reader: on a wide screen the text keeps its reading width, and a tap
  // in the margins beside it is a tap away from it
  const readerSurfaceRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()
  const sendReaderIntent = useReaderIntent()
  // The scroll listener keeps its own state between events: an effect event leaves it subscribed.
  const sendControlsIntent = useEffectEvent((kind: 'hide-controls' | 'show-controls') => {
    void sendReaderIntent({ kind })
  })
  const [parallelViewportWidth, setParallelViewportWidth] = useState(0)
  useEffect(() => {
    if (!keepControlsVisible) return
    const update = () => setParallelViewportWidth(window.innerWidth)
    window.addEventListener('resize', update)
    update()
    return () => window.removeEventListener('resize', update)
  }, [keepControlsVisible])
  // Desktop percentages apply to the reading width; mobile percentages remain viewport-based.
  // Include the existing column spacing so 100% allows 580 px of text.
  const parallelColumnWidth =
    keepControlsVisible && parallelViewportWidth > 0
      ? (((READING_TEXT_MAX_WIDTH * preferredColumnWidth) / 100 + 15) / parallelViewportWidth) * 100
      : preferredColumnWidth

  // Refs for horizontal scroll sync between header and content
  const [followsColumnsScroll] = useState(canFollowColumnsScroll)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  // The verses content: the highlight layer scrolls with it in horizontal parallel display
  const versesContentRef = useRef<HTMLDivElement>(null)

  // Annotation mode state (lifted here to break circular dependency)
  const [selection, setSelection] = useState<SelectionRange | null>(null)
  const [tokensCache] = useState<Map<string, WordToken[]>>(() => new Map())

  // Every version on screen, the main one first, with its verses
  const isParallelVerseMode = Boolean(parallelVerses?.length)
  const displayedVersions = [version, ...(parallelVerses ?? []).map(parallel => parallel.id)]
  const displayedVersionsKey = displayedVersions.join(',')
  // Kept between renders: the highlight layer measures the page again whenever it changes
  const versesByVersion = useMemo<Record<string, TVerse[]>>(
    () => ({
      ...Object.fromEntries((parallelVerses ?? []).map(parallel => [parallel.id, parallel.verses])),
      [version]: verses,
    }),
    [parallelVerses, version, verses]
  )
  const redWordsByVersion = { ...parallelRedWords, [version]: redWords ?? null }

  // Clear tokens cache and selection when versions change to avoid stale word indices
  useEffect(() => {
    tokensCache.clear()
    setSelection(null)
  }, [displayedVersionsKey])

  // Build a Map from verseKey to Verse for O(1) lookups, for each version
  const versesMapByVersion = new Map(
    Object.entries(versesByVersion).map(([versionId, versionVerses]) => [
      versionId,
      buildVersesMap(versionVerses),
    ])
  )
  const getVerse = ({ version: verseVersion, verseKey }: VerseTarget) =>
    versesMapByVersion.get(verseVersion)?.get(verseKey)

  // State for touched verse (for visual feedback)
  const [touchedVerse, setTouchedVerse] = useState<VerseTarget | null>(null)
  // The selection the native side holds, with the taps it has not sent back yet
  const verseSelection = useOptimisticVerseSelection({
    selectedVerses,
    selectedVersesVersion: selectedVersesVersion ?? version,
  })
  const { shownSelection } = verseSelection
  const decidedSelectedVerses = verseSelection.decidedSelection.selectedVerses
  const [returnToSelectedVersePosition, setReturnToSelectedVersePosition] = useState<
    'top' | 'bottom' | null
  >(null)
  const annotationInlineContentKey = [
    displayedVersionsKey,
    interlinearMode || '',
    annotationMode ? 'annotation' : 'reading',
    contextDisplayMode || '',
    focusVerses?.join(',') || '',
    settings.textDisplay,
    parallelDisplayMode,
    ...Object.entries(versesByVersion).flatMap(([versionId, versionVerses]) =>
      versionVerses.map(verse => {
        const verseKey = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`
        return [
          versionId,
          verseKey,
          verse.TextRevision || verse.Texte,
          verse.StrongSpans?.length || 0,
          verse.StrongSpans?.filter(span => span.transliteration).length || 0,
          verse.ReverseInterlinearSpans?.length || 0,
          verse.InterlinearTokens?.length || 0,
          JSON.stringify(redWordsByVersion[versionId]?.[verseKey] || []),
        ].join(':')
      })
    ),
  ].join('|')

  // Tokens getter function with caching. Tokens only depend on the text: the same verse
  // in two versions gets its own tokens.
  const getTokens = (_verseKey: string, text: string): WordToken[] => {
    if (!tokensCache.has(text)) {
      tokensCache.set(text, tokenizeVerseText(text))
    }
    return tokensCache.get(text)!
  }

  // Horizontal parallel display scrolls its columns: the highlight layer is drawn inside the
  // scrolled content so it follows them, everywhere else over the whole reader.
  const isHorizontalParallelMode = isParallelVerseMode && parallelDisplayMode === 'horizontal'
  const titlesFollowColumnsScroll = followsColumnsScroll && isHorizontalParallelMode
  const highlightOriginRef = isHorizontalParallelMode ? versesContentRef : containerRef
  // What the columns hold reads at the size their width allows
  const columnSettings = isHorizontalParallelMode
    ? {
        ...settings,
        fontSizeScale: getParallelColumnFontSizeScale(settings.fontSizeScale, preferredColumnWidth),
      }
    : settings

  // Gesture handlers for unified touch selection. Interlinear presentations of a version
  // have their own gestures: the reader leaves them alone, version by version.
  const versionModes = new Map([
    [version, interlinearMode],
    ...(parallelVerses ?? []).map(parallel => [parallel.id, parallel.interlinearMode] as const),
  ])
  const hasReverseInterlinear = (versionId: string) =>
    (versesByVersion[versionId] ?? []).some(verse => Boolean(verse.ReverseInterlinearSpans?.length))
  const isVersionGestureSuppressed = (versionId: string) =>
    shouldSuppressVerseGestures(versionId, versionModes.get(versionId)) ||
    hasReverseInterlinear(versionId)
  // Interlinear presentations hold no personal Bible data: their columns show none (ADR-0030).
  const interlinearReadingVersions = displayedVersions.filter(isVersionGestureSuppressed)
  const annotatedVersions = displayedVersions.filter(
    versionId => !interlinearReadingVersions.includes(versionId)
  )

  // Words of interlinear presentations cannot be annotated (different DOM structure)
  const canAnnotateVersion = (versionId: string) =>
    !isVersionGestureSuppressed(versionId) &&
    !(
      versionId === 'BHG' &&
      (versesByVersion[versionId] ?? []).some(verse => Boolean(verse.InterlinearTokens?.length))
    )

  // Selected verses get handles where they can turn into selected words: in reading mode, in a
  // version whose words can be annotated. Parallel reading: in the first column showing it.
  const verseSelectionVersion = shownSelection.selectedVersesVersion
  const verseSelectionBlocks =
    !annotationMode && !isSelectionMode && canAnnotateVersion(verseSelectionVersion)
      ? getVerseSelectionBlocks({
          selectedVerses: shownSelection.selectedVerses,
          verses: versesByVersion[verseSelectionVersion] ?? [],
          version: verseSelectionVersion,
          column: isParallelVerseMode
            ? displayedVersions.indexOf(verseSelectionVersion)
            : undefined,
          getTokens,
        })
      : []

  // Use shared hook for annotation highlights (with selection support when in annotation mode)
  const { highlightRects, selectionHandlePositions, verseSelectionHandles } =
    useAnnotationHighlights({
      containerRef: highlightOriginRef,
      wordAnnotations,
      versions: annotatedVersions,
      book: book.Numero,
      chapter,
      versesByVersion,
      settings,
      layoutKey: `${parallelDisplayMode}:${parallelColumnWidth}`,
      contextDisplayMode,
      focusVerses,
      // Words selected by a double tap or a dragged handle show at once, before the native side
      // confirms annotation mode
      selection,
      getTokens,
      verseSelectionBlocks,
    })
  const [isVerseLayoutAnimating, setIsVerseLayoutAnimating] = useState(false)
  const versePositionLayoutProps = useVersePositionLayoutProps(
    versesContentRef,
    setIsVerseLayoutAnimating
  )

  // One word selected in the column of the version it was touched in
  const createWordSelection = (target: VerseTarget, wordIndex: number): SelectionRange => ({
    start: { verseKey: target.verseKey, wordIndex },
    end: { verseKey: target.verseKey, wordIndex },
    version: target.version,
    ...(target.column === undefined ? {} : { column: target.column }),
  })

  const handleTapVerseAnnotationMode = (
    target: VerseTarget,
    position: { x: number; y: number }
  ) => {
    const containerRect = highlightOriginRef.current?.getBoundingClientRect()
    if (!containerRect) return

    // Check if clicked on an annotation
    const clickedAnnotationId = findClickedAnnotationId(highlightRects, containerRect, position)

    if (clickedAnnotationId) {
      setSelection(null)
      const newAnnotationId =
        clickedAnnotationId === selectedAnnotationId ? null : clickedAnnotationId
      void sendReaderIntent({ kind: 'select-word-annotation', annotationId: newAnnotationId })
      return
    }

    // A tap on the selected words keeps them
    if (isClickInsideSelection(highlightRects, containerRect, position)) {
      return
    }

    // Anywhere else, the words are let go and annotation mode ends: a double tap selects others
    exitAnnotationMode()
  }

  const exitAnnotationMode = () => {
    setSelection(null)
    void sendReaderIntent({ kind: 'exit-annotation-mode' })
  }

  // A tap away from the text: annotation mode ends, selected verses are all unselected
  const handleTapEmpty = () => {
    if (annotationMode) {
      exitAnnotationMode()
      return
    }
    if (Object.keys(verseSelection.decidedSelection.selectedVerses).length === 0) return
    verseSelection.showClearedSelection()
    void sendReaderIntent({ kind: 'clear-selected-verses' })
  }

  // Dragging a handle of selected verses turns the block into the words it holds, in annotation
  // mode: the verses are let go, and the other blocks with them.
  const handleVerseHandleDragStart = (range: SelectionRange) => {
    verseSelection.showClearedSelection()
    void sendReaderIntent({
      kind: 'enter-annotation-mode',
      version: range.version,
      verseKey: range.end.verseKey,
    })
  }

  // A tapped verse is selected in the version it was tapped in.
  const toggleSelectedVerse = (target: VerseTarget) => {
    verseSelection.showSentToggle(target)
    void sendReaderIntent({
      kind: 'toggle-selected-verse',
      verseKey: target.verseKey,
      version: target.version,
    })
  }

  // The Strong resources of the verse, in the version it was touched in.
  const navigateToVerseDetail = (target: VerseTarget) => {
    const verse = getVerse(target)
    if (!verse) return
    void sendReaderIntent({
      kind: 'open',
      origin: 'verse',
      verseKey: `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`,
      ...(target.version && { version: target.version }),
      target: { kind: 'verse-resource', resource: 'strong' },
    })
  }

  const handleTapVerseSelectionMode = (target: VerseTarget) => {
    if (isSelectionMode?.includes('verse')) {
      toggleSelectedVerse(target)
      return
    }

    if (isSelectionMode?.includes('strong')) navigateToVerseDetail(target)
  }

  const handleTapVerseNormalMode = (target: VerseTarget) => {
    if (doesTapToggleVerse(target)) {
      toggleSelectedVerse(target)
    } else {
      navigateToVerseDetail(target)
    }
  }

  // In parallel display, a row can stand for a verse a version omits
  // (Acts 8:37 in the ESV): its actions all work on that version, so it stays inert.
  const isVerseMissingFromVersion = (target: VerseTarget) => !getVerse(target)

  // Whether a tap selects or unselects this verse, rather than opening or annotating it
  const doesTapToggleVerse = (target: VerseTarget) =>
    !isVersionGestureSuppressed(target.version) &&
    !isVerseMissingFromVersion(target) &&
    !annotationMode &&
    (isSelectionMode
      ? Boolean(isSelectionMode.includes('verse'))
      : Object.keys(decidedSelectedVerses).length > 0 || settings.press === 'longPress')

  // Whether a double tap on this verse would do anything (see handleDoubleTapVerse). Where it
  // would not, a tap is acted on at once instead of waiting to rule one out.
  const canDoubleTapVerse = (target: VerseTarget) =>
    canAnnotateVersion(target.version) &&
    !isVerseMissingFromVersion(target) &&
    (annotationMode || Object.keys(decidedSelectedVerses).length === 0)

  // The tap waits to rule out a double tap: show the verse selected already
  const handleTapVerseHeld = (target: VerseTarget) => {
    if (doesTapToggleVerse(target)) verseSelection.showHeldToggle(target)
  }

  const handleTapVerse = (target: VerseTarget, position: { x: number; y: number }) => {
    if (isVersionGestureSuppressed(target.version) || isVerseMissingFromVersion(target)) return

    if (annotationMode) {
      handleTapVerseAnnotationMode(target, position)
      return
    }

    if (isSelectionMode) {
      handleTapVerseSelectionMode(target)
      return
    }

    handleTapVerseNormalMode(target)
  }

  const handleDoubleTapVerse = (target: VerseTarget, position: { x: number; y: number }) => {
    // The first tap of a double tap only selects a word, not the verse it showed selected
    verseSelection.discardHeldToggles()
    if (!canAnnotateVersion(target.version)) return

    // Find the word at the double-tap position
    const verse = getVerse(target)
    if (!verse) return

    const tokens = getTokens(target.verseKey, verse.Texte)
    const caretInfo = getCaretInfoFromPoint(position.x, position.y)

    let newSelection: SelectionRange | null = null
    if (caretInfo) {
      const wordIndex = getWordIndexFromCharOffset(tokens, caretInfo.charOffset)
      if (wordIndex !== null) {
        newSelection = createWordSelection(target, wordIndex)
      }
    }

    // Check if double-tap is on an existing annotation
    const containerRect = highlightOriginRef.current?.getBoundingClientRect()
    const clickedId = containerRect
      ? findClickedAnnotationId(highlightRects, containerRect, position)
      : null

    if (annotationMode) {
      // In annotation mode, double-tap on annotation selects it, otherwise creates/updates selection
      if (clickedId) {
        setSelection(null)
        const newAnnotationId = clickedId === selectedAnnotationId ? null : clickedId
        void sendReaderIntent({ kind: 'select-word-annotation', annotationId: newAnnotationId })
      } else if (newSelection) {
        // Clear annotation selection
        if (selectedAnnotationId) {
          void sendReaderIntent({ kind: 'select-word-annotation', annotationId: null })
        }
        setSelection(newSelection)
      }
      return
    }

    // Normal mode: don't enter annotation mode if verses are selected
    if (Object.keys(decidedSelectedVerses).length > 0) return

    // Enter annotation mode, on the version double-tapped
    void sendReaderIntent({
      kind: 'enter-annotation-mode',
      version: target.version,
      verseKey: target.verseKey,
    })

    // If double-tap is on an annotation, select it; otherwise create a selection on the word
    if (clickedId) {
      void sendReaderIntent({ kind: 'select-word-annotation', annotationId: clickedId })
    } else if (newSelection) {
      setSelection(newSelection)
    }
  }

  const handleLongPressVerse = (target: VerseTarget) => {
    if (isVersionGestureSuppressed(target.version) || isVerseMissingFromVersion(target)) return
    if (annotationMode) return // No long-press action in annotation mode
    if (isSelectionMode) return // No long-press in selection mode

    if (settings.press === 'shortPress') {
      toggleSelectedVerse(target)
    } else {
      navigateToVerseDetail(target)
    }
  }

  // Horizontal parallel display: in annotation mode, the reader moves the columns itself so
  // that a slow drag selects words; a quick swipe brings the next column into view.
  const scrollToAdjacentColumn = (direction: 'left' | 'right') => {
    const scrollElement = contentScrollRef.current
    if (!scrollElement) return
    const columnWidthPx = getParallelColumnPitch(parallelColumnWidth)
    const columnIndex = Math.round(scrollElement.scrollLeft / columnWidthPx)
    const nextIndex = Math.max(
      0,
      Math.min(displayedVersions.length - 1, columnIndex + (direction === 'left' ? 1 : -1))
    )
    scrollElement.scrollTo({ left: nextIndex * columnWidthPx, behavior: 'smooth' })
  }

  // Annotation mode controller (handles touch selection and annotation events)
  useAnnotationModeController({
    containerRef,
    gestureSurfaceRef: readerSurfaceRef,
    highlightOriginRef,
    annotationMode,
    versesByVersion,
    sendReaderIntent,
    selection,
    setSelection,
    getTokens,
    highlightRects,
    selectionHandlePositions,
    verseSelectionHandles,
    selectedAnnotationId,
    triggers: {
      clearSelectionTrigger,
      applyAnnotationTrigger,
      eraseSelectionTrigger,
    },
    callbacks: {
      onMouseSelectionStart: target => {
        if (
          !canAnnotateVersion(target.version) ||
          isSelectionMode ||
          Object.keys(decidedSelectedVerses).length > 0
        )
          return false
        void sendReaderIntent({
          kind: 'enter-annotation-mode',
          version: target.version,
          verseKey: target.verseKey,
        })
        return true
      },
      onTapVerse: handleTapVerse,
      shouldWaitForDoubleTap: canDoubleTapVerse,
      onTapVerseHeld: handleTapVerseHeld,
      onDoubleTapVerse: handleDoubleTapVerse,
      onLongPressVerse: handleLongPressVerse,
      onTouchedVerseChange: target =>
        setTouchedVerse(target && !isVersionGestureSuppressed(target.version) ? target : null),
      onTapEmpty: handleTapEmpty,
      onVerseHandleDragStart: handleVerseHandleDragStart,
      // Horizontal parallel mode scrolls its columns instead of changing chapter
      onSwipe: isHorizontalParallelMode
        ? annotationMode
          ? scrollToAdjacentColumn
          : undefined
        : direction => {
            void sendReaderIntent({
              kind: direction === 'left' ? 'next-chapter' : 'previous-chapter',
            })
          },
    },
  })

  const columnTextModeControlsKey = columnTextModeControls
    ?.map(controls => `${controls.strong ? 'S' : ''}${controls.interlinear ? 'I' : ''}`)
    .join(',')

  // Horizontal parallel display: the version titles follow the columns. With a scroll timeline,
  // each title only needs the range of scroll over which it keeps to the left edge. Otherwise
  // the header is scrolled with the columns and each title sticks to the left edge of its column.
  useEffect(() => {
    // Only run when in parallel mode
    const hasParallelVersions = Boolean(parallelVerses?.length)
    if (!hasParallelVersions) return

    const headerEl = headerScrollRef.current
    const contentEl = contentScrollRef.current
    if (!headerEl) return

    if (followsColumnsScroll) {
      const updateTitleRanges = () => {
        const columnWidthPx = getParallelColumnPitch(parallelColumnWidth)
        headerEl.querySelectorAll<HTMLElement>('[data-version-title]').forEach((titleEl, i) => {
          // The title reaches the left edge once its own margin in the column has scrolled by
          const pinStart = i * columnWidthPx + titleEl.offsetLeft
          const travel = Math.max(
            0,
            columnWidthPx - titleEl.offsetLeft - titleEl.offsetWidth - TITLE_EDGE_MARGIN
          )
          titleEl.style.setProperty('--title-range-start', `${pinStart}px`)
          titleEl.style.setProperty('--title-range-end', `${pinStart + travel}px`)
          titleEl.style.setProperty('--title-travel', `${travel}px`)
        })
      }
      updateTitleRanges()
      window.addEventListener('resize', updateTitleRanges)
      return () => window.removeEventListener('resize', updateTitleRanges)
    }

    const handleScroll = () => {
      headerEl.scrollLeft = contentEl?.scrollLeft || document.documentElement.scrollLeft
    }

    // Initial call
    handleScroll()

    // Web scrolls inside the reader; retain document scroll support for native WebViews.
    contentEl?.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      contentEl?.removeEventListener('scroll', handleScroll)
      document.removeEventListener('scroll', handleScroll)
    }
    // The title ranges depend on each title's width, which its mode buttons change.
  }, [
    parallelVerses?.length,
    parallelColumnWidth,
    parallelDisplayMode,
    followsColumnsScroll,
    columnTextModeControlsKey,
  ])

  const expandedHeaderHeight =
    HEADER_HEIGHT + getPassageContextHeaderHeight(focusVerses, annotationMode, inPlan)
  useEffect(() => {
    if (isFormSheet) return
    if (keepControlsVisible) {
      document.documentElement.style.setProperty('--header-height', `${expandedHeaderHeight}px`)
      setReaderFooterHeight(true)
      return
    }

    const scrollTarget = getDOMScrollTarget(containerRef.current)

    let lastScrollTop = getDOMScrollTop(scrollTarget)
    let lastScrollTime = Date.now()
    const VELOCITY_THRESHOLD = 400
    let canSwipeDown = true
    let canSwipeUp = true
    let reachedBoundaries = false

    const handleScroll = () => {
      const currentScrollTop = getDOMScrollTop(scrollTarget)
      const currentTime = Date.now()
      const timeDiff = currentTime - lastScrollTime
      const scrollDiff = currentScrollTop - lastScrollTop

      // Calculate velocity (pixels per millisecond)
      const velocity = Math.abs(scrollDiff / timeDiff)

      // Get total scrollable height
      const totalHeight = getDOMScrollHeight(scrollTarget) - getDOMViewportHeight(scrollTarget)

      // Don't dispatch if scroll is beyond boundaries (iOS momentum scrolling)
      if (currentScrollTop < 0 || currentScrollTop > totalHeight) {
        if (!reachedBoundaries) {
          sendControlsIntent('show-controls')
          document.documentElement.style.setProperty('--header-height', `${expandedHeaderHeight}px`)
          setReaderFooterHeight(true)
        }
        reachedBoundaries = true
        return
      }

      reachedBoundaries = false

      // Only trigger if velocity is above threshold
      if (velocity * 1000 > VELOCITY_THRESHOLD) {
        if (scrollDiff > 0 && canSwipeDown) {
          if (window.disableSwipeDownEvent) return
          sendControlsIntent('hide-controls')
          document.documentElement.style.setProperty('--header-height', `${HEADER_HEIGHT_MIN}px`)
          setReaderFooterHeight(false)
          canSwipeDown = false
          canSwipeUp = true
        } else if (scrollDiff < 0 && canSwipeUp) {
          sendControlsIntent('show-controls')
          document.documentElement.style.setProperty('--header-height', `${expandedHeaderHeight}px`)
          setReaderFooterHeight(true)
          canSwipeUp = false
          canSwipeDown = true
        }
      }

      lastScrollTop = currentScrollTop
      lastScrollTime = currentTime
    }

    return addDOMScrollListener(scrollTarget, handleScroll)
  }, [isFormSheet, keepControlsVisible, expandedHeaderHeight])

  const hasVerses = verses.length > 0
  const headerHeight =
    (isFormSheet ? BIBLE_FORM_SHEET_HEADER_HEIGHT : HEADER_HEIGHT) +
    getPassageContextHeaderHeight(focusVerses, annotationMode, inPlan)
  const scrollTargetVerse = getScrollTargetVerse({
    verseToScroll,
    contextDisplayMode,
    focusVerses,
  })
  const focusKey = focusVerses?.join(',') ?? ''
  const annotationScrollKey = contextDisplayMode === 'focused' ? annotationMode : false
  const selectedVerseKeys = Object.keys(selectedVerses)
  const selectedVerseKey = selectedVerseKeys[selectedVerseKeys.length - 1]
  const selectedVerseLocation = selectedVerseKey
    ? selectedVerseKey.split('-').map(value => Number(value))
    : []
  const [selectedBook, selectedChapter, selectedVerseNumber] = selectedVerseLocation
  const canScrollToSelectedVerse =
    selectedBook === book.Numero && selectedChapter === chapter && Boolean(selectedVerseNumber)
  const selectedVerseElementId = canScrollToSelectedVerse
    ? `verset-${selectedVerseNumber}`
    : undefined

  const getSelectedVerseElement = () =>
    selectedVerseElementId ? document.getElementById(selectedVerseElementId) : null

  const getReturnToSelectedVersePosition = (): 'top' | 'bottom' | null => {
    const element = getSelectedVerseElement()
    if (!element) return null

    const rect = element.getBoundingClientRect()
    const scrollTarget = getDOMScrollTarget(containerRef.current)
    const viewportBottom =
      getDOMViewportHeight(scrollTarget) - RETURN_TO_SELECTED_VERSE_BOTTOM_OFFSET

    if (rect.bottom < headerHeight) return 'top'
    if (rect.top > viewportBottom) return 'bottom'
    return null
  }

  const scrollSelectedVerseToMiddle = (behavior: ScrollBehavior = 'smooth') => {
    const element = getSelectedVerseElement()
    if (!element) return

    const rect = element.getBoundingClientRect()
    const scrollTarget = getDOMScrollTarget(containerRef.current)
    window.disableSwipeDownEvent = true
    scrollDOMTo(scrollTarget, {
      top:
        getDOMScrollTop(scrollTarget) +
        rect.top -
        getDOMViewportHeight(scrollTarget) / 2 +
        rect.height / 2,
      behavior,
    })
    setReturnToSelectedVersePosition(null)
    setTimeout(() => {
      window.disableSwipeDownEvent = false
      setReturnToSelectedVersePosition(getReturnToSelectedVersePosition())
    }, 450)
  }

  useEffect(() => {
    if (!hasVerses) return
    if (scrollTargetVerse === 1) {
      scrollDOMTo(getDOMScrollTarget(containerRef.current), { top: 0 })
    }
    // A focus opened from lower in the chapter comes back to the top too.
  }, [chapter, scrollTargetVerse, hasVerses, verseNavigationRequest, contextDisplayMode, focusKey])

  useEffect(() => {
    if (!scrollTargetVerse || !hasVerses) return

    if (scrollTargetVerse === 1) return

    requestAnimationFrame(() => {
      const element = document.querySelector(`#verset-${scrollTargetVerse}`)
      if (element) {
        const scrollTarget = getDOMScrollTarget(containerRef.current)
        window.disableSwipeDownEvent = true
        // The verse lands under the header and the passage's pill, with a little air.
        const elementPosition = element.getBoundingClientRect().top
        scrollDOMTo(scrollTarget, {
          top: getDOMScrollTop(scrollTarget) + elementPosition - headerHeight - 12,
        })
        setTimeout(() => {
          window.disableSwipeDownEvent = false
        }, 400)
      }
    })
  }, [
    scrollTargetVerse,
    hasVerses,
    annotationScrollKey,
    contextDisplayMode,
    focusKey,
    verseNavigationRequest,
  ])

  // The scroll helpers read the selection of the latest render without being triggers.
  const scrollSelectedVerseIntoMiddle = useEffectEvent(() => scrollSelectedVerseToMiddle('smooth'))
  const readReturnToSelectedVersePosition = useEffectEvent(getReturnToSelectedVersePosition)

  useEffect(() => {
    if (!selectedVerseElementId || !hasVerses) {
      setReturnToSelectedVersePosition(null)
      return
    }

    requestAnimationFrame(() => scrollSelectedVerseIntoMiddle())
  }, [selectedVerseElementId, hasVerses])

  useEffect(() => {
    if (!selectedVerseElementId) return

    const scrollTarget = getDOMScrollTarget(containerRef.current)
    let rafId: number | null = null
    const updateVisibility = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        setReturnToSelectedVersePosition(readReturnToSelectedVersePosition())
      })
    }

    updateVisibility()
    const removeScrollListener = addDOMScrollListener(scrollTarget, updateVisibility)
    window.addEventListener('resize', updateVisibility)

    return () => {
      removeScrollListener()
      window.removeEventListener('resize', updateVisibility)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [selectedVerseElementId, headerHeight])

  const navigateToPericope = () => {
    void sendReaderIntent({ kind: 'open', origin: 'heading', target: { kind: 'pericopes' } })
  }

  const chooseColumnVersion = (column: number) => {
    void sendReaderIntent({ kind: 'choose-column-version', column })
  }

  const openColumnTextMode = (mode: 'strong' | 'interlinear', column: number) => {
    void sendReaderIntent({ kind: 'open-column-text-mode', mode, column })
  }

  const isHebreu = version === 'BHS' || (version === 'BHG' && Number(verses[0].Livre) < 40)
  const highlightLayer = !isVerseLayoutAnimating &&
    (highlightRects.length > 0 || selection || verseSelectionHandles.length > 0) && (
      <HighlightLayer $overflowVisible={isHorizontalParallelMode}>
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
            $isDimmed={rect.isDimmed}
            $primaryColor={settings.colors[settings.theme].primary}
            $backgroundColor={settings.colors[settings.theme].reverse}
            $animationDelay={rect.type === 'annotation' ? getAnimationDelay(rect.id) : 0}
          />
        ))}
        <SelectionHandles
          hasSelection={selection !== null}
          startPosition={selectionHandlePositions.start}
          endPosition={selectionHandlePositions.end}
        />
        {/* Selected verses: two handles per block of verses that follow one another */}
        {!selection &&
          verseSelectionHandles.map(handles => (
            <SelectionHandles
              key={`${handles.range.start.verseKey}:${handles.range.end.verseKey}`}
              hasSelection
              startPosition={handles.start}
              endPosition={handles.end}
            />
          ))}
      </HighlightLayer>
    )
  const isParallelVerse = Boolean(parallelVerses?.length)
  const parallelVersionTitles = isParallelVerse
    ? extractParallelVersionTitles(parallelVerses, version)
    : []
  const isContextFocused = contextDisplayMode === 'focused'
  const passageMediaGallerySections = getPassageMediaGallerySections({
    passageMedia,
    sectionTitles: translations.passageMediaSections,
  })
  const passageMediaGalleryItems = getPassageMediaGalleryItems(passageMediaGallerySections)

  return (
    <TranslationsProvider translations={translations}>
      <GlobalStyles />
      <div ref={readerSurfaceRef} style={{ width: '100%' }}>
        <Container
          ref={containerRef}
          rtl={isHebreu}
          settings={settings}
          isParallelVerse={
            isParallelVerse && (!keepControlsVisible || parallelDisplayMode === 'horizontal')
          }
          headerHeight={headerHeight}
          $columnsScrollScope={titlesFollowColumnsScroll}
          $scrollsColumns={isHorizontalParallelMode}
        >
          {/* Highlight layer for word annotations and selection */}
          {!isHorizontalParallelMode && highlightLayer}
          {isParallelVerse && parallelDisplayMode === 'horizontal' && (
            <HeaderScrollWrapper
              ref={headerScrollRef}
              columnCount={parallelVersionTitles.length}
              $followsScroll={titlesFollowColumnsScroll}
            >
              <VersionsContainer
                columnCount={parallelVersionTitles.length}
                columnWidth={parallelColumnWidth}
                $followsScroll={titlesFollowColumnsScroll}
              >
                {parallelVersionTitles?.map((p, i) => (
                  <VersionTitleColumn
                    key={i}
                    columnCount={parallelVersionTitles.length}
                    columnWidth={parallelColumnWidth}
                  >
                    <VersionTitleGroup
                      data-version-title={i}
                      // Columns after the first open with a gap: each pill keeps to its text
                      style={{ marginInlineStart: i === 0 ? 0 : PARALLEL_COLUMN_GAP }}
                      $followsScroll={titlesFollowColumnsScroll}
                    >
                      <VersionChip
                        settings={settings}
                        version={p.id}
                        hasError={Boolean(p.error)}
                        controls={columnTextModeControls?.[i]}
                        withChevron
                        onVersionPress={() => chooseColumnVersion(i)}
                        onTextModePress={kind => openColumnTextMode(kind, i)}
                      />
                    </VersionTitleGroup>
                  </VersionTitleColumn>
                ))}
              </VersionsContainer>
            </HeaderScrollWrapper>
          )}
          {/* The chapter opens above its featured introduction and below secondary media, which
              stay at the very top. Both keep their place in the tree and swap by order, so the
              media morph and the opening slides when the chapter changes. */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {!isContextFocused && (
              <div
                style={
                  isHorizontalParallelMode
                    ? { paddingInline: `${BIBLE_READING_HORIZONTAL_PADDING}px` }
                    : undefined
                }
              >
                <PassageMediaThumbnails
                  items={passageMedia.introduction}
                  gallerySections={passageMediaGallerySections}
                  placement="introduction"
                  settings={settings}
                  isDisabled={annotationMode}
                  isCompact={!passageMedia.isIntroductionStartChapter}
                />
              </div>
            )}
            {/* A passage shown for itself (plan, context, focus) opens on its verses */}
            {!focusVerses?.length && !inPlan && (
              <m.div
                layout="position"
                layoutDependency={passageMedia.isIntroductionStartChapter}
                transition={{ layout: getOverlayLayoutTransition(shouldReduceMotion) }}
                style={{ order: passageMedia.isIntroductionStartChapter ? -1 : 1 }}
              >
                <ChapterOpening
                  settings={settings}
                  book={book}
                  chapter={chapter}
                  bookName={translations.chapterOpening.bookName}
                  chapterLabel={translations.chapterOpening.chapter}
                  psalmLabel={translations.chapterOpening.psalm}
                  originalTitle={translations.chapterOpening.originalTitle}
                />
              </m.div>
            )}
          </div>
          <HorizontalScrollWrapper
            ref={contentScrollRef}
            columnCount={
              isParallelVerse && parallelDisplayMode === 'horizontal'
                ? parallelVersionTitles.length
                : 1
            }
            $panYOnly={isHorizontalParallelMode && Boolean(annotationMode)}
            $scrollTimeline={titlesFollowColumnsScroll}
            $scrollsColumns={isHorizontalParallelMode}
          >
            <ColumnsBlock
              $columnsWidth={
                isHorizontalParallelMode
                  ? getParallelColumnsWidth(parallelVersionTitles.length, parallelColumnWidth)
                  : undefined
              }
            >
              {isHebreu && (
                <RightDirection settings={settings}>Sens de la lecture ←</RightDirection>
              )}
              {/* Introduction media sit above the columns, at the original scroll origin */}
              <EntityChipsDOM
                items={focusedMetadataItems}
                color={settings.colors[settings.theme].primary}
                backgroundColor={settings.colors[settings.theme].lightPrimary}
                onPress={(type, id) => {
                  void onFocusedMetadataPress?.(type, id)
                }}
              />
              <ReadingPositionKeeper
                verses={verses}
                version={version}
                location={`${book.Numero}-${chapter}`}
                isDisabled={isContextFocused}
                readingLine={headerHeight}
                containerRef={containerRef}
              />
              <m.div
                ref={versesContentRef}
                style={{ position: 'relative' }}
                {...versePositionLayoutProps}
              >
                {/* Highlight layer drawn inside the columns it marks */}
                {isHorizontalParallelMode && highlightLayer}
                {/* Unified verse rendering for all modes */}
                <UnifiedVersesRenderer
                  isPassagePreview={Boolean(focusVerses?.length)}
                  inlineCommentaries={inlineCommentaries}
                  verses={verses}
                  parallelVerses={parallelVerses}
                  interlinearReadingVersions={interlinearReadingVersions}
                  focusVerses={focusVerses}
                  selectedVerses={shownSelection.selectedVerses}
                  selectedVersesVersion={shownSelection.selectedVersesVersion}
                  highlightedVerses={highlightedVerses}
                  settings={columnSettings}
                  verseToScroll={verseToScroll}
                  contextDisplayMode={contextDisplayMode}
                  version={version}
                  interlinearMode={interlinearMode}
                  pericopeChapter={pericopeChapter}
                  parallelPericopeChapters={parallelPericopeChapters}
                  isSelectionMode={isSelectionMode}
                  selectedCode={selectedCode}
                  isHebreu={isHebreu}
                  isParallelVerse={
                    isParallelVerse &&
                    (!keepControlsVisible || parallelDisplayMode === 'horizontal')
                  }
                  wordAnnotations={wordAnnotations}
                  wordAnnotationsInOtherVersions={wordAnnotationsInOtherVersions}
                  taggedVerses={taggedVerses}
                  bookmarkedVerses={bookmarkedVerses}
                  annotationNotesCountByVerse={annotationNotesCountByVerse}
                  relationItemsCount={relationItemsCount}
                  relationItemsText={relationItemsText}
                  versesWithAnnotationNotes={versesWithAnnotationNotes}
                  navigateToPericope={navigateToPericope}
                  annotationMode={annotationMode}
                  touchedVerse={touchedVerse}
                  taggedVersesInChapter={taggedVersesInChapter}
                  versesWithNonHighlightTags={versesWithNonHighlightTags}
                  columnCount={isParallelVerse ? parallelVersionTitles.length : 1}
                  columnWidth={parallelColumnWidth}
                  parallelDisplayMode={parallelDisplayMode}
                  columnTextModeControls={columnTextModeControls}
                  redWordsByVersion={redWordsByVersion}
                  passageMediaAfterVerses={passageMedia.afterVerses}
                  passageMediaGallerySections={passageMediaGallerySections}
                />
                <AnnotationInlineItems
                  wordAnnotations={wordAnnotations}
                  annotationRelationItems={annotationRelationItems}
                  versions={annotatedVersions}
                  settings={columnSettings}
                  annotationMode={annotationMode}
                  contentKey={annotationInlineContentKey}
                />
              </m.div>
            </ColumnsBlock>
          </HorizontalScrollWrapper>
          {isContextFocused && focusStudy && focusStudyTranslations && (
            <FocusVerseStudy
              study={focusStudy}
              translations={focusStudyTranslations}
              entities={chapterEntities}
              portraits={chapterEntityPortraits}
              settings={settings}
              version={version}
              isDisabled={annotationMode}
            />
          )}
          <ChapterEntities
            entities={chapterEntities}
            portraits={chapterEntityPortraits}
            loaded={chapterEntitiesLoaded}
            availabilityStatus={chapterEntityModuleStatus}
            downloadState={chapterEntityDownloadState}
            settings={settings}
            translations={chapterEntityTranslations}
            chapterResources={
              !isContextFocused && passageMediaGalleryItems.length ? (
                <PassageMediaThumbnails
                  items={passageMediaGalleryItems}
                  gallerySections={passageMediaGallerySections}
                  placement="chapter-resources"
                  settings={settings}
                  isDisabled={annotationMode}
                  blockMargin={0}
                />
              ) : null
            }
            onOpenEntity={uniqueName => {
              void sendReaderIntent({
                kind: 'open',
                origin: 'chapter-entities',
                target: { kind: 'biblical-entity', entityKey: uniqueName },
              })
            }}
            onOpenMap={places => {
              void sendReaderIntent({
                kind: 'open',
                origin: 'chapter-entities',
                target: { kind: 'map', places },
              })
            }}
            onDownload={() => {
              void sendReaderIntent({ kind: 'install-biblical-entities' })
            }}
            onDismiss={() => {
              void sendReaderIntent({ kind: 'hide-contextual-information' })
            }}
          />
          {planDayStep && !annotationMode && (
            <PlanDayStepCard
              step={planDayStep}
              settings={settings}
              onPress={() => {
                void sendReaderIntent({ kind: 'plan-day-step' })
              }}
            />
          )}
          <ReturnToSelectedVerseButton
            type="button"
            settings={settings}
            $position={returnToSelectedVersePosition}
            onClick={() => scrollSelectedVerseToMiddle()}
            aria-label="Retourner au verset sélectionné"
          >
            <Feather
              name={returnToSelectedVersePosition === 'top' ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={settings.colors[settings.theme].primary}
            />
          </ReturnToSelectedVerseButton>
        </Container>
      </div>
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
    </TranslationsProvider>
  )
}

// ============================================================================
// MAIN VERSES RENDERER (lightweight shell)
// ============================================================================

const BibleDOMErrorContent = ({
  settings,
  translations,
  error,
  errorDownloadState,
  isResettingDatabase,
  headerHeight,
  isConnected,
  onlineOnly,
}: Pick<Props, 'settings' | 'translations' | 'error' | 'errorDownloadState'> & {
  error: BibleError
  isResettingDatabase?: boolean
  headerHeight: number
  isConnected: boolean
  onlineOnly?: boolean
}) => {
  const isDownloading =
    errorDownloadState?.status === 'queued' ||
    errorDownloadState?.status === 'downloading' ||
    errorDownloadState?.status === 'inserting'
  const sendReaderIntent = useReaderIntent()
  const progressLabel =
    errorDownloadState?.status === 'inserting' ? translations.inserting : translations.downloading
  const failurePresentation = getBibleDOMErrorPresentation(error, isConnected, { onlineOnly })
  const canAcquire = failurePresentation.actions.includes('download')
  const canRepair = failurePresentation.actions.includes('repair')
  const canManage = failurePresentation.actions.includes('manage')
  const canReset = failurePresentation.actions.includes('reset')
  const canRetry = failurePresentation.actions.includes('retry')
  const connectionRequired = failurePresentation.connectionRequired

  return (
    <TranslationsProvider translations={translations}>
      <GlobalStyles />
      <ErrorContainer settings={settings} headerHeight={headerHeight}>
        <ErrorContent>
          <ErrorIcon settings={settings}>
            <Feather
              name={failurePresentation.icon}
              size={26}
              color={settings.colors[settings.theme].primary}
            />
          </ErrorIcon>
          <ErrorMessage settings={settings}>
            {translations.resourceFailureDetails[failurePresentation.detailKey]}
          </ErrorMessage>
          {(canAcquire || canRepair) &&
            (isDownloading ? (
              <>
                <ProgressTrack settings={settings}>
                  <ProgressBar settings={settings} $progress={errorDownloadState?.progress ?? 0} />
                </ProgressTrack>
                <ErrorMessage settings={settings}>{progressLabel}</ErrorMessage>
              </>
            ) : (
              <ErrorButton
                settings={settings}
                type="button"
                disabled={connectionRequired}
                onClick={() =>
                  connectionRequired
                    ? undefined
                    : void sendReaderIntent({
                        kind: 'install-bible-version',
                        version: error.version,
                      })
                }
              >
                {connectionRequired
                  ? translations.connectionRequired
                  : canRepair
                    ? translations.repairOfflineCopy
                    : translations.downloadVersion}
              </ErrorButton>
            ))}
          {canRetry && (
            <ErrorButton
              settings={settings}
              type="button"
              onClick={() => void sendReaderIntent({ kind: 'retry-bible-resource' })}
            >
              {translations.retry}
            </ErrorButton>
          )}
          {(canManage || canReset) && (
            <>
              {canManage && (
                <ErrorButton
                  settings={settings}
                  type="button"
                  onClick={() => void sendReaderIntent({ kind: 'open-downloads' })}
                >
                  {translations.goToDownloads}
                </ErrorButton>
              )}
              {canReset && (
                <ErrorButton
                  settings={settings}
                  $secondary
                  type="button"
                  disabled={isResettingDatabase}
                  onClick={() => void sendReaderIntent({ kind: 'repair-bible-database' })}
                >
                  {translations.resetDatabase}
                </ErrorButton>
              )}
            </>
          )}
        </ErrorContent>
      </ErrorContainer>
    </TranslationsProvider>
  )
}

const VersesRendererContent = ({ settings, translations, verses, ...rest }: Props) => {
  const sendPageSignal = useReaderPageSignal()
  useFonts({
    'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
  })

  const headerHeight =
    (rest.isFormSheet ? BIBLE_FORM_SHEET_HEADER_HEIGHT : HEADER_HEIGHT) +
    getPassageContextHeaderHeight(rest.focusVerses, rest.annotationMode, rest.inPlan)

  useEffect(() => {
    sendPageSignal({ kind: 'mounted' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On Android one page serves every Bible Tab, and it reaches a Tab before it has painted that
  // Tab's chapter. Once the browser has painted the verses, the application learns which Tab and
  // chapter are on screen, so that a Tab's preview never shows the chapter of another Tab.
  const { tabId } = rest
  const paintedBook = verses[0] ? Number(verses[0].Livre) : undefined
  const paintedChapter = verses[0] ? Number(verses[0].Chapitre) : undefined
  const signalPaint = useEffectEvent((book: number, chapter: number) => {
    sendPageSignal({ kind: 'painted', tabId, book, chapter })
  })
  useEffect(() => {
    if (paintedBook === undefined || paintedChapter === undefined) return
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => signalPaint(paintedBook, paintedChapter))
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [tabId, paintedBook, paintedChapter])

  useEffect(() => {
    const reverseColor = settings.colors[settings.theme].reverse
    document.documentElement.style.setProperty('--header-height', `${headerHeight}px`)
    setReaderFooterHeight(true)
    document.documentElement.style.setProperty('--safe-area-top', `${rest.safeAreaTop ?? 0}px`)
    document.documentElement.style.backgroundColor = reverseColor
    document.body.style.backgroundColor = reverseColor
  }, [headerHeight, rest.safeAreaTop, settings.colors, settings.theme])

  // Keep the WebView document background in sync when Expo DOM reuses the same page.
  useEffect(() => {
    if (settings?.theme) {
      const reverseColor = settings.colors[settings.theme].reverse
      document.documentElement.style.backgroundColor = reverseColor
      document.body.style.backgroundColor = reverseColor
    }
  }, [settings.colors, settings?.theme])

  if (rest.error) {
    return (
      <BibleDOMErrorContent
        settings={settings}
        translations={translations}
        error={rest.error}
        errorDownloadState={rest.errorDownloadState}
        isResettingDatabase={rest.isResettingDatabase}
        headerHeight={headerHeight}
        isConnected={rest.isConnected}
        onlineOnly={rest.onlineOnly}
      />
    )
  }

  if (!verses.length) {
    return (
      <TranslationsProvider translations={translations}>
        <GlobalStyles />
        <Container
          settings={settings}
          rtl={false}
          isParallelVerse={false}
          headerHeight={headerHeight}
        />
      </TranslationsProvider>
    )
  }

  return (
    <LoadedBibleContent settings={settings} translations={translations} verses={verses} {...rest} />
  )
}

const VersesRenderer = (props: Props) => (
  <ReaderIntentProvider
    tabId={props.tabId}
    onReaderIntent={props.onReaderIntent}
    onPageSignal={props.onPageSignal}
  >
    <OverlayCloseRequestProvider value={props.closeOverlayTrigger ?? 0}>
      <LazyMotion features={domMax} strict>
        <VersesRendererContent {...props} />
      </LazyMotion>
    </OverlayCloseRequestProvider>
  </ReaderIntentProvider>
)

export default VersesRenderer
