'use dom'

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
import React, { useEffect, useState, useRef } from 'react'
import { Verse as TVerse } from '~common/types'
import {
  Dispatch,
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
import {
  ENTER_ANNOTATION_MODE,
  DOWNLOAD_BIBLE_VERSION,
  NAVIGATE_TO_PERICOPE,
  NAVIGATE_TO_VERSION,
  OPEN_COLUMN_TEXT_MODE,
  SWIPE_LEFT,
  SWIPE_RIGHT,
  SWIPE_DOWN,
  SWIPE_UP,
  NAVIGATE_TO_BIBLE_VERSE_DETAIL,
  NAVIGATE_TO_BIBLICAL_ENTITY,
  TOGGLE_SELECTED_VERSE,
  OPEN_DOWNLOADS,
  RESET_BIBLE_DATABASE,
  RETRY_BIBLE_RESOURCE,
  DOWNLOAD_CHAPTER_ENTITIES,
  DISMISS_CONTEXTUAL_INFORMATION,
  PLAN_DAY_STEP,
  DOM_COMPONENT_MOUNTED,
} from './dispatch'
import { DispatchProvider } from './DispatchProvider'
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
// Unified verse renderer
import { UnifiedVersesRenderer } from './UnifiedVersesRenderer'
import AnnotationInlineItems from './AnnotationInlineItems'
import { isDarkTheme } from './utils'
import { getScrollTargetVerse } from './verseRenderingModel'
import { shouldSuppressVerseGestures } from '~helpers/interlinearDisplayMode'
import ChapterEntities from './ChapterEntities'
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
  'isSelectedMode',
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
  | 'chapterEntityModuleStatus'
  | 'chapterEntityDownloadState'
> & {
  focusedMetadataItems?: EntityChip[]
  onFocusedMetadataPress?: (type: EntityChip['type'], id: string) => Promise<void>
  dispatch: Dispatch
  dom: import('expo/dom').DOMProps
  translations: BibleDOMTranslations
  chapterEntityTranslations: {
    title: string
    groups: { person: string; place: string; group: string; supernatural: string; other: string }
    openEntity: string
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
    border: `1px solid ${colors[theme].border}`,
    background: colors[theme].reverse,
    color: colors[theme].primary,
    boxShadow: isDarkTheme(theme)
      ? '0 8px 24px rgba(0, 0, 0, 0.45)'
      : '0 8px 24px rgba(0, 0, 0, 0.18)',
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
    borderRadius: '8px',
    border: `1px solid ${$secondary ? colors[theme].border : colors[theme].primary}`,
    background: $secondary ? colors[theme].reverse : colors[theme].primary,
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
  dispatch,
  translations,
  inlineCommentaries,
  chapterEntities,
  chapterEntitiesLoaded,
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
  const shouldReduceMotion = useReducedMotion()
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
  const versesByVersion: Record<string, TVerse[]> = {
    ...Object.fromEntries((parallelVerses ?? []).map(parallel => [parallel.id, parallel.verses])),
    [version]: verses,
  }
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

  // Use shared hook for annotation highlights (with selection support when in annotation mode)
  const { highlightRects, selectionHandlePositions } = useAnnotationHighlights({
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
    // Pass selection only when in annotation mode
    selection: annotationMode ? selection : undefined,
    getTokens: annotationMode ? getTokens : undefined,
  })
  const [isVerseLayoutAnimating, setIsVerseLayoutAnimating] = useState(false)
  const [versePositionLayoutProps] = useState(() =>
    createVersePositionLayoutProps({
      getTransform: () => versesContentRef.current?.style.transform,
      onAnimationStart: () => setIsVerseLayoutAnimating(true),
      onAnimationSettled: () => setIsVerseLayoutAnimating(false),
    })
  )

  // Words of interlinear presentations cannot be annotated (different DOM structure)
  const canAnnotateVersion = (versionId: string) =>
    !isVersionGestureSuppressed(versionId) &&
    !(
      versionId === 'BHG' &&
      (versesByVersion[versionId] ?? []).some(verse => Boolean(verse.InterlinearTokens?.length))
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

    // No selection exists -- create one on the clicked word, in the version tapped
    if (!canAnnotateVersion(target.version)) return
    const verse = getVerse(target)
    if (!verse) return

    const tokens = getTokens(target.verseKey, verse.Texte)
    const caretInfo = getCaretInfoFromPoint(position.x, position.y)
    if (!caretInfo) return

    const wordIndex = getWordIndexFromCharOffset(tokens, caretInfo.charOffset)
    if (wordIndex === null) return

    setSelection(createWordSelection(target, wordIndex))
  }

  // A tapped verse is selected in the version it was tapped in.
  const toggleSelectedVerse = (target: VerseTarget) => {
    dispatch({
      type: TOGGLE_SELECTED_VERSE,
      payload: target,
    }).catch(console.error)
  }

  const navigateToVerseDetail = (target: VerseTarget) => {
    const verse = getVerse(target)
    if (!verse) return
    dispatch({
      type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
      params: { verse, version: target.version },
    }).catch(console.error)
  }

  const handleTapVerseSelectionMode = (target: VerseTarget) => {
    if (isSelectionMode?.includes('verse')) {
      toggleSelectedVerse(target)
      return
    }

    if (isSelectionMode?.includes('strong')) {
      const verse = getVerse(target)
      if (verse) {
        dispatch({
          type: NAVIGATE_TO_BIBLE_VERSE_DETAIL,
          params: {
            isSelectionMode,
            verse,
            version: target.version,
          },
        }).catch(console.error)
      }
    }
  }

  const handleTapVerseNormalMode = (target: VerseTarget) => {
    const isSelectedMode = Boolean(Object.keys(selectedVerses).length)
    if (isSelectedMode || settings.press === 'longPress') {
      toggleSelectedVerse(target)
    } else {
      navigateToVerseDetail(target)
    }
  }

  // In parallel display, a row can stand for a verse a version omits
  // (Acts 8:37 in the ESV): its actions all work on that version, so it stays inert.
  const isVerseMissingFromVersion = (target: VerseTarget) => !getVerse(target)

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

    // Enter annotation mode, on the version double-tapped
    dispatch({
      type: ENTER_ANNOTATION_MODE,
      payload: { version: target.version, verseKey: target.verseKey },
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
    highlightOriginRef,
    annotationMode,
    versesByVersion,
    dispatch,
    selection,
    setSelection,
    getTokens,
    highlightRects,
    selectionHandlePositions,
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
          Object.keys(selectedVerses).length > 0
        )
          return false
        dispatch({
          type: ENTER_ANNOTATION_MODE,
          payload: { version: target.version, verseKey: target.verseKey },
        }).catch(console.error)
        return true
      },
      onTapVerse: handleTapVerse,
      onDoubleTapVerse: handleDoubleTapVerse,
      onLongPressVerse: handleLongPressVerse,
      onTouchedVerseChange: target =>
        setTouchedVerse(target && !isVersionGestureSuppressed(target.version) ? target : null),
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
      // Horizontal parallel mode scrolls its columns instead of changing chapter
      onSwipe: isHorizontalParallelMode
        ? annotationMode
          ? scrollToAdjacentColumn
          : undefined
        : direction => {
            dispatch({
              type: direction === 'left' ? SWIPE_LEFT : SWIPE_RIGHT,
            }).catch(console.error)
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
          dispatch({
            type: SWIPE_UP,
          })
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
          dispatch({
            type: SWIPE_DOWN,
          })
          document.documentElement.style.setProperty('--header-height', `${HEADER_HEIGHT_MIN}px`)
          setReaderFooterHeight(false)
          canSwipeDown = false
          canSwipeUp = true
        } else if (scrollDiff < 0 && canSwipeUp) {
          dispatch({
            type: SWIPE_UP,
          })
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
  }, [dispatch, isFormSheet, keepControlsVisible, expandedHeaderHeight])

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
  }, [chapter, scrollTargetVerse, hasVerses, verseNavigationRequest])

  useEffect(() => {
    if (!scrollTargetVerse || !hasVerses) return

    if (scrollTargetVerse === 1) return

    requestAnimationFrame(() => {
      const element = document.querySelector(`#verset-${scrollTargetVerse}`)
      if (element) {
        const scrollTarget = getDOMScrollTarget(containerRef.current)
        window.disableSwipeDownEvent = true
        const elementPosition = element.getBoundingClientRect().top
        scrollDOMTo(scrollTarget, {
          top: getDOMScrollTop(scrollTarget) + elementPosition - 100,
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

  useEffect(() => {
    if (!selectedVerseElementId || !hasVerses) {
      setReturnToSelectedVersePosition(null)
      return
    }

    requestAnimationFrame(() => scrollSelectedVerseToMiddle('smooth'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVerseElementId, hasVerses])

  useEffect(() => {
    if (!selectedVerseElementId) return

    const scrollTarget = getDOMScrollTarget(containerRef.current)
    let rafId: number | null = null
    const updateVisibility = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        setReturnToSelectedVersePosition(getReturnToSelectedVersePosition())
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVerseElementId, headerHeight])

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

  const openColumnTextMode = (kind: 'strong' | 'interlinear', column: number) => {
    dispatch({
      type: OPEN_COLUMN_TEXT_MODE,
      payload: { kind, column },
    })
  }

  const isHebreu = version === 'BHS' || (version === 'BHG' && Number(verses[0].Livre) < 40)
  const highlightLayer = !isVerseLayoutAnimating &&
    (highlightRects.length > 0 || (annotationMode && selection)) && (
      <HighlightLayer
        $dimmed={!annotationMode && Object.keys(selectedVerses).length > 0}
        $overflowVisible={isHorizontalParallelMode}
      >
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
        {/* Selection handles - only in annotation mode */}
        {annotationMode && (
          <SelectionHandles
            hasSelection={selection !== null}
            startPosition={selectionHandlePositions.start}
            endPosition={selectionHandlePositions.end}
          />
        )}
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
      <DispatchProvider dispatch={dispatch}>
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
                        onVersionPress={() => navigateToVersion(p.id, i)}
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
                  selectedVerses={selectedVerses}
                  selectedVersesVersion={selectedVersesVersion ?? version}
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
          <ChapterEntities
            entities={chapterEntities}
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
              void dispatch({ type: NAVIGATE_TO_BIBLICAL_ENTITY, payload: uniqueName })
            }}
            onDownload={() => {
              void dispatch({ type: DOWNLOAD_CHAPTER_ENTITIES })
            }}
            onDismiss={() => {
              void dispatch({ type: DISMISS_CONTEXTUAL_INFORMATION })
            }}
          />
          {planDayStep && !annotationMode && (
            <PlanDayStepCard
              step={planDayStep}
              settings={settings}
              onPress={() => {
                void dispatch({ type: PLAN_DAY_STEP })
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

const BibleDOMErrorContent = ({
  settings,
  dispatch,
  translations,
  error,
  errorDownloadState,
  isResettingDatabase,
  headerHeight,
  isConnected,
  onlineOnly,
}: Pick<Props, 'settings' | 'dispatch' | 'translations' | 'error' | 'errorDownloadState'> & {
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
      <DispatchProvider dispatch={dispatch}>
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
                    <ProgressBar
                      settings={settings}
                      $progress={errorDownloadState?.progress ?? 0}
                    />
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
                      : dispatch({ type: DOWNLOAD_BIBLE_VERSION, payload: error.version }).catch(
                          console.error
                        )
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
                onClick={() => dispatch({ type: RETRY_BIBLE_RESOURCE }).catch(console.error)}
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
                    onClick={() => dispatch({ type: OPEN_DOWNLOADS }).catch(console.error)}
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
                    onClick={() => dispatch({ type: RESET_BIBLE_DATABASE }).catch(console.error)}
                  >
                    {translations.resetDatabase}
                  </ErrorButton>
                )}
              </>
            )}
          </ErrorContent>
        </ErrorContainer>
      </DispatchProvider>
    </TranslationsProvider>
  )
}

const VersesRendererContent = ({ settings, dispatch, translations, verses, ...rest }: Props) => {
  useFonts({
    'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
  })

  const headerHeight =
    (rest.isFormSheet ? BIBLE_FORM_SHEET_HEADER_HEIGHT : HEADER_HEIGHT) +
    getPassageContextHeaderHeight(rest.focusVerses, rest.annotationMode, rest.inPlan)

  useEffect(() => {
    dispatch({
      type: DOM_COMPONENT_MOUNTED,
    }).catch(console.error)
  }, [])

  useEffect(() => {
    const reverseColor = settings.colors[settings.theme].reverse
    document.documentElement.style.setProperty('--header-height', `${headerHeight}px`)
    setReaderFooterHeight(true)
    document.documentElement.style.setProperty('--safe-area-top', `${rest.safeAreaTop ?? 0}px`)
    document.documentElement.style.backgroundColor = reverseColor
    document.body.style.backgroundColor = reverseColor
  }, [dispatch, headerHeight, rest.safeAreaTop, settings.colors, settings.theme])

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
        dispatch={dispatch}
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
        <DispatchProvider dispatch={dispatch}>
          <Container
            settings={settings}
            rtl={false}
            isParallelVerse={false}
            headerHeight={headerHeight}
          />
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

const VersesRenderer = (props: Props) => (
  <LazyMotion features={domMax} strict>
    <VersesRendererContent {...props} />
  </LazyMotion>
)

export default VersesRenderer
