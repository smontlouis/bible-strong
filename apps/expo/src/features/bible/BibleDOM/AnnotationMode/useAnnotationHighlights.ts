'use dom'

import { RefObject, useEffect, useLayoutEffect, useState } from 'react'
import { Verse as TVerse } from '~common/types'
import { getTokenByWordIndex, tokenizeVerseText, WordToken } from '~helpers/wordTokenizer'
import { RootStyles, WebViewProps } from '../BibleDOMWrapper'
import { AnnotationType, HighlightRect } from './HighlightComponents'
import {
  SelectionRange,
  TEXT_SELECTION_COLOR,
  normalizeRange,
  getVersesBetween,
} from './selectionUtils'
import { usePrevious } from '~helpers/usePrevious'
import { getFocusVerseNumbers, isVerseDimmedInFocusedContext } from '../verseRenderingModel'
import {
  clampAnnotationWordRange,
  collectAnnotationTextNodes,
  createAnnotationTextRanges,
} from './annotationDomText'
import { subscribeToBibleLayoutChanges } from '../annotationLayoutLifecycle'
import { findVerseTextElement, findVerseTextElements } from './verseTargets'

/**
 * Merges all DOMRects on the same line into single rectangles.
 * This creates cleaner highlights when canonical Strong references create
 * multiple DOM text nodes.
 */
function mergeRectsOnSameLine(rects: DOMRect[]): DOMRect[] {
  if (rects.length === 0) return []

  // Group rects by line (using top position with tolerance)
  const lineGroups: Map<number, DOMRect[]> = new Map()
  const LINE_TOLERANCE = 5 // pixels

  for (const rect of rects) {
    // Find existing line group or create new one
    let foundLine: number | null = null
    for (const lineTop of lineGroups.keys()) {
      if (Math.abs(rect.top - lineTop) < LINE_TOLERANCE) {
        foundLine = lineTop
        break
      }
    }

    if (foundLine !== null) {
      lineGroups.get(foundLine)!.push(rect)
    } else {
      lineGroups.set(rect.top, [rect])
    }
  }

  // Merge each line group into a single rect spanning from leftmost to rightmost
  const merged: DOMRect[] = []
  for (const lineRects of lineGroups.values()) {
    const left = Math.min(...lineRects.map(r => r.left))
    const right = Math.max(...lineRects.map(r => r.right))
    const top = Math.min(...lineRects.map(r => r.top))
    const height = Math.max(...lineRects.map(r => r.height))
    merged.push(new DOMRect(left, top, right - left, height))
  }

  // Sort by top position for consistent ordering
  return merged.sort((a, b) => a.top - b.top)
}

interface UseAnnotationHighlightsProps {
  // The element the highlight layer is drawn in: rects are relative to it
  containerRef: RefObject<HTMLDivElement | null>
  wordAnnotations: WebViewProps['wordAnnotations']
  // Every version on screen, each showing its own annotations
  versions: string[]
  book: number
  chapter: number
  versesByVersion: Record<string, TVerse[]>
  settings: RootStyles['settings']
  // Changes when the verses are laid out differently (parallel display mode, column width)
  layoutKey?: string
  contextDisplayMode?: WebViewProps['contextDisplayMode']
  focusVerses?: WebViewProps['focusVerses']
  // Optional: Selection support for annotation mode
  selection?: SelectionRange | null
  getTokens?: (verseKey: string, text: string) => WordToken[]
  // Selected verses, as the word ranges of the blocks of verses that follow one another:
  // each block gets its own handles
  verseSelectionBlocks?: SelectionRange[]
}

/**
 * Common parameters for calculating highlight rects for a word range within a verse.
 */
interface CalculateRectsParams {
  version: string
  // Parallel reading: only the verse shown in this column, when a version is shown twice
  column?: number
  verseKey: string
  startWordIndex: number
  endWordIndex: number
  containerRect: DOMRect
  tokens: WordToken[]
}

/**
 * Calculates DOMRects for a word range within a verse.
 * Returns merged rects relative to the container.
 */
function calculateRectsForWordRange({
  version,
  column,
  verseKey,
  startWordIndex,
  endWordIndex,
  containerRect,
  tokens,
}: CalculateRectsParams): Array<{ top: number; left: number; width: number; height: number }> {
  return findVerseTextElements(version, verseKey, column).flatMap(verseEl =>
    calculateRectsInVerseElement(verseEl, startWordIndex, endWordIndex, containerRect, tokens)
  )
}

function calculateRectsInVerseElement(
  verseEl: Element,
  startWordIndex: number,
  endWordIndex: number,
  containerRect: DOMRect,
  tokens: WordToken[]
): Array<{ top: number; left: number; width: number; height: number }> {
  // Collect all text nodes to handle canonical Strong references.
  const { fullText, textNodes } = collectAnnotationTextNodes(verseEl)
  if (!fullText || textNodes.length === 0) return []

  const displayRange = clampAnnotationWordRange(
    startWordIndex,
    endWordIndex,
    tokens.filter(token => !token.isWhitespace).length
  )
  if (!displayRange) return []
  const startToken = getTokenByWordIndex(tokens, displayRange.start)
  const endToken = getTokenByWordIndex(tokens, displayRange.end)
  if (!startToken || !endToken) return []

  try {
    const domRanges = createAnnotationTextRanges(textNodes, startToken.charStart, endToken.charEnd)
    if (domRanges.length === 0) return []

    // Merge adjacent rects on same line for cleaner highlights
    const clientRects = mergeRectsOnSameLine(
      domRanges.flatMap(range => Array.from(range.getClientRects()))
    )

    return clientRects.map(rect => ({
      top: rect.top - containerRect.top,
      left: rect.left - containerRect.left,
      width: rect.width,
      height: rect.height,
    }))
  } catch (e) {
    console.error('[Bible] Error calculating rects:', e)
    return []
  }
}

/**
 * Calculates highlight rectangles for a selection range.
 * Used in annotation mode to show the current word selection.
 */
function getRectsForSelection(
  containerRef: RefObject<HTMLDivElement | null>,
  range: SelectionRange,
  verses: TVerse[],
  getTokens: (verseKey: string, text: string) => WordToken[]
): HighlightRect[] {
  const { version, column } = range
  const rects: HighlightRect[] = []
  const containerRect = containerRef.current?.getBoundingClientRect()
  if (!containerRect) return rects

  const { start: normalizedStart, end: normalizedEnd } = normalizeRange(range, verses)
  const versesToHighlight = getVersesBetween(
    verses,
    normalizedStart.verseKey,
    normalizedEnd.verseKey
  )

  versesToHighlight.forEach((verse, idx) => {
    if (verse.Verset === 0) return

    const verseKey = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`
    const tokens = getTokens(verseKey, verse.Texte)
    const wordTokens = tokens.filter(t => !t.isWhitespace)
    if (wordTokens.length === 0) return

    const isFirst = idx === 0
    const isLast = idx === versesToHighlight.length - 1

    const startWordIdx = isFirst ? normalizedStart.wordIndex : 0
    const endWordIdx = isLast ? normalizedEnd.wordIndex : wordTokens[wordTokens.length - 1].index

    const verseRects = calculateRectsForWordRange({
      version,
      column,
      verseKey,
      startWordIndex: startWordIdx,
      endWordIndex: endWordIdx,
      containerRect,
      tokens,
    })

    verseRects.forEach((rect, rectIdx) => {
      rects.push({
        id: `selection-${version}-${column ?? ''}-${verseKey}-${rectIdx}`,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        color: TEXT_SELECTION_COLOR,
        type: 'selection',
      })
    })
  })

  return rects
}

const isSameRects = (
  a: Pick<HighlightRect, 'top' | 'left' | 'width' | 'height'>[],
  b: Pick<HighlightRect, 'top' | 'left' | 'width' | 'height'>[]
) =>
  a.length === b.length &&
  a.every(
    (rect, index) =>
      rect.top === b[index].top &&
      rect.left === b[index].left &&
      rect.width === b[index].width &&
      rect.height === b[index].height
  )

// Every field drawn: a pass that measures the same highlights keeps the same state
const isSameHighlightRects = (a: HighlightRect[], b: HighlightRect[]) =>
  a.length === b.length &&
  a.every(
    (rect, index) =>
      rect.id === b[index].id &&
      rect.color === b[index].color &&
      rect.annotationType === b[index].annotationType &&
      rect.isDimmed === b[index].isDimmed
  ) &&
  isSameRects(a, b)

export type HandlePositions = {
  start: { x: number; y: number } | null
  end: { x: number; y: number } | null
}

const EMPTY_HANDLE_POSITIONS: HandlePositions = { start: null, end: null }

/** A block of selected verses and where its handles stand. */
export interface VerseSelectionHandles extends HandlePositions {
  range: SelectionRange
}

// The handles of a selection: before its first word and after its last one
function getHandlePositions(
  selectionRects: Pick<HighlightRect, 'top' | 'left' | 'width' | 'height'>[],
  isRTL: boolean
): HandlePositions {
  if (selectionRects.length === 0) return EMPTY_HANDLE_POSITIONS

  // Sort rects by position (top to bottom, then left to right for LTR, right to left for RTL)
  const sortedRects = [...selectionRects].sort((a, b) => {
    if (Math.abs(a.top - b.top) > 5) return a.top - b.top
    return isRTL ? b.left - a.left : a.left - b.left
  })

  const firstRect = sortedRects[0]
  const lastRect = sortedRects[sortedRects.length - 1]

  // Add small vertical offset for better visual alignment with text
  const HANDLE_OFFSET = 2
  return {
    start: isRTL
      ? { x: firstRect.left + firstRect.width, y: firstRect.top + HANDLE_OFFSET }
      : { x: firstRect.left, y: firstRect.top + HANDLE_OFFSET },
    end: isRTL
      ? { x: lastRect.left, y: lastRect.top + lastRect.height - HANDLE_OFFSET }
      : { x: lastRect.left + lastRect.width, y: lastRect.top + lastRect.height - HANDLE_OFFSET },
  }
}

export function useAnnotationHighlights({
  containerRef,
  wordAnnotations,
  versions,
  book,
  chapter,
  versesByVersion,
  settings,
  layoutKey,
  contextDisplayMode,
  focusVerses,
  selection,
  getTokens,
  verseSelectionBlocks = [],
}: UseAnnotationHighlightsProps): {
  highlightRects: HighlightRect[]
  selectionHandlePositions: HandlePositions
  verseSelectionHandles: VerseSelectionHandles[]
} {
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([])
  // The selected words, measured apart from the annotations (see below)
  const [selectionRects, setSelectionRects] = useState<HighlightRect[]>([])
  const [verseSelectionHandles, setVerseSelectionHandles] = useState<VerseSelectionHandles[]>([])
  // The blocks only change with the selected verses: a key keeps the layout pass from rerunning
  const verseSelectionBlocksKey = JSON.stringify(verseSelectionBlocks)
  const [isRTL, setIsRTL] = useState(false)
  // Track if we're waiting for new rects to be calculated after a chapter change
  const [isPending, setIsPending] = useState(true)

  // Create a stable key based on annotation IDs and dates
  // Includes the date to detect modifications (color, type, etc.)
  const annotationKey = wordAnnotations
    ? Object.entries(wordAnnotations)
        .map(([id, ann]) => `${id}:${ann.date}`)
        .sort()
        .join(',')
    : ''

  // Track previous values to detect chapter changes vs annotation/selection changes
  const prevBook = usePrevious(book)
  const prevChapter = usePrevious(chapter)
  const focusVerseNumbers = getFocusVerseNumbers(focusVerses)
  const isContextFocused = contextDisplayMode === 'focused'
  const focusKey = focusVerses?.join(',') ?? ''
  const versionsKey = versions.join(',')

  useEffect(() => {
    // Only set isPending on chapter/book changes (not annotation or selection changes)
    // This prevents the flash when annotations are added/deleted/modified
    const isChapterChange = prevBook !== book || prevChapter !== chapter

    if (isChapterChange) {
      setIsPending(true)
    }

    if (!containerRef.current) {
      setHighlightRects([])
      if (isChapterChange) {
        setIsPending(false)
      }
      return
    }

    const calculateAnnotationRects = (): HighlightRect[] => {
      const rects: HighlightRect[] = []
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect || !wordAnnotations) return rects

      // Cache tokenization results by verse to avoid re-tokenizing
      // when multiple annotations reference the same verse of a version
      const tokensByVerse = new Map<string, ReturnType<typeof tokenizeVerseText>>()

      Object.entries(wordAnnotations).forEach(([annotationId, annotation]) => {
        const { version } = annotation
        if (!versions.includes(version)) return

        annotation.ranges.forEach((range, rangeIdx) => {
          const { verseKey, startWordIndex, endWordIndex } = range
          const isDimmed = isVerseDimmedInFocusedContext({
            verseKey,
            isContextFocused,
            focusVerseNumbers,
          })

          const verseTokensKey = `${version}:${verseKey}`
          let tokens = tokensByVerse.get(verseTokensKey)
          if (!tokens) {
            const verseTextEl = findVerseTextElement(version, verseKey)
            if (!verseTextEl) return

            const { fullText } = collectAnnotationTextNodes(verseTextEl)
            if (!fullText) return

            tokens = tokenizeVerseText(fullText)
            tokensByVerse.set(verseTokensKey, tokens)
          }

          const verseRects = calculateRectsForWordRange({
            version,
            verseKey,
            startWordIndex,
            endWordIndex,
            containerRect,
            tokens,
          })

          // Resolve color: check default colors, then custom colors, then fallback to raw value or default
          const DEFAULT_HIGHLIGHT_COLOR = 'rgba(255, 255, 0, 0.3)' // Yellow fallback
          const colorValue =
            settings.colors[settings.theme][
              annotation.color as keyof (typeof settings.colors)[typeof settings.theme]
            ] ||
            settings.customHighlightColors?.find(c => c.id === annotation.color)?.hex ||
            annotation.color ||
            DEFAULT_HIGHLIGHT_COLOR

          verseRects.forEach((rect, rectIdx) => {
            rects.push({
              id: `${annotationId}-${rangeIdx}-${rectIdx}`,
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              color: colorValue as string,
              type: 'annotation',
              annotationType: annotation.type as AnnotationType,
              annotationId,
              isDimmed,
            })
          })
        })
      })

      return rects
    }

    const calculateVerseSelectionHandles = (isRTLLayout: boolean): VerseSelectionHandles[] =>
      getTokens
        ? verseSelectionBlocks.map(range => ({
            range,
            ...getHandlePositions(
              getRectsForSelection(
                containerRef,
                range,
                versesByVersion[range.version] ?? [],
                getTokens
              ),
              isRTLLayout
            ),
          }))
        : []

    const updateLayoutState = () => {
      const rects = calculateAnnotationRects()
      const container = containerRef.current
      const isRTLLayout = container ? getComputedStyle(container).direction === 'rtl' : false
      const handles = calculateVerseSelectionHandles(isRTLLayout)
      setIsRTL(isRTLLayout)
      // Setting equal rects anew would render again, run this pass again, and loop every frame
      setHighlightRects(previous => (isSameHighlightRects(previous, rects) ? previous : rects))
      setVerseSelectionHandles(previous =>
        JSON.stringify(previous) === JSON.stringify(handles) ? previous : handles
      )
    }

    requestAnimationFrame(() => {
      updateLayoutState()
      if (isChapterChange) {
        setIsPending(false)
      }
    })

    const handleResize = () => {
      requestAnimationFrame(() => {
        updateLayoutState()
      })
    }

    // Listen for layout changes (e.g., VerseTags expand/collapse)
    const handleLayoutChanged = () => {
      requestAnimationFrame(() => {
        updateLayoutState()
      })
    }

    window.addEventListener('resize', handleResize)
    const unsubscribeFromLayoutChanges = subscribeToBibleLayoutChanges(handleLayoutChanged)
    return () => {
      window.removeEventListener('resize', handleResize)
      unsubscribeFromLayoutChanges()
    }
  }, [
    versionsKey,
    book,
    chapter,
    annotationKey,
    versesByVersion,
    settings,
    layoutKey,
    isContextFocused,
    focusKey,
    verseSelectionBlocksKey,
  ])

  // The selected words are measured before the screen is painted: when a handle is dragged off
  // selected verses, their background goes in the same frame as the words' comes, and the words
  // let go of leave with the mode. Measuring a selection only reads its own lines.
  useLayoutEffect(() => {
    const measure = () => {
      const next =
        selection && getTokens && containerRef.current
          ? getRectsForSelection(
              containerRef,
              selection,
              versesByVersion[selection.version] ?? [],
              getTokens
            )
          : []
      // The same rects keep the same state: setting them anew would render again without end
      setSelectionRects(previous => (isSameRects(previous, next) ? previous : next))
    }
    measure()
    if (!selection) return

    // The text moves under the selection: measure it again with the annotations
    const measureNextFrame = () => requestAnimationFrame(measure)
    window.addEventListener('resize', measureNextFrame)
    const unsubscribeFromLayoutChanges = subscribeToBibleLayoutChanges(measureNextFrame)
    return () => {
      window.removeEventListener('resize', measureNextFrame)
      unsubscribeFromLayoutChanges()
    }
  }, [selection, versesByVersion, settings, layoutKey, versionsKey, book, chapter])

  // Calculate selection handle positions synchronously from highlight rects
  const selectionHandlePositions = getHandlePositions(selectionRects, isRTL)

  // Return empty array while pending to prevent flash of old positions
  // BUT allow selection to show during isPending (for drag-to-select feedback)
  return {
    highlightRects: [...(isPending ? [] : highlightRects), ...selectionRects],
    selectionHandlePositions,
    verseSelectionHandles: isPending ? [] : verseSelectionHandles,
  }
}
