'use dom'

import { RefObject, useEffect, useState } from 'react'
import { Verse as TVerse } from '~common/types'
import { getTokenByWordIndex, tokenizeVerseText, WordToken } from '~helpers/wordTokenizer'
import { RootStyles, WebViewProps } from '../BibleDOMWrapper'
import { AnnotationType, HighlightRect } from './HighlightComponents'
import { SelectionRange, normalizeRange, getVersesBetween } from './selectionUtils'
import { usePrevious } from '~helpers/usePrevious'

/**
 * Represents a text node and its character offset within the combined verse text.
 * Used to map character positions across multiple DOM text nodes (needed for LSGS/KJVS
 * versions where Strong's references create a complex DOM structure).
 */
interface TextNodeInfo {
  node: Text
  startOffset: number // character offset in combined text
  endOffset: number
}

/**
 * Collects all text nodes within an element and tracks their character offsets.
 * This allows mapping character positions to the correct DOM nodes even when
 * the verse text is split across multiple text nodes (e.g., around Strong's refs).
 */
function collectTextNodes(element: Element): {
  fullText: string
  textNodes: TextNodeInfo[]
} {
  const textNodes: TextNodeInfo[] = []
  let currentOffset = 0

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let node: Text | null

  while ((node = walker.nextNode() as Text | null)) {
    // Skip detached nodes (safety check)
    if (!node.parentElement || !document.contains(node)) continue

    const length = node.textContent?.length || 0
    if (length > 0) {
      textNodes.push({
        node,
        startOffset: currentOffset,
        endOffset: currentOffset + length,
      })
      currentOffset += length
    }
  }

  return {
    fullText: textNodes.map(t => t.node.textContent).join(''),
    textNodes,
  }
}

/**
 * Creates a DOM range that spans multiple text nodes based on character indices.
 * Returns null if the start or end position cannot be found in the text nodes.
 */
function createRangeAcrossNodes(
  textNodes: TextNodeInfo[],
  startCharIndex: number,
  endCharIndex: number
): Range | null {
  let startNode: Text | null = null
  let startOffset = 0
  let endNode: Text | null = null
  let endOffset = 0

  for (const info of textNodes) {
    // Find start node (startCharIndex falls within this node's range)
    if (!startNode && startCharIndex >= info.startOffset && startCharIndex < info.endOffset) {
      startNode = info.node
      startOffset = startCharIndex - info.startOffset
    }
    // Find end node (endCharIndex falls within this node's range)
    if (endCharIndex > info.startOffset && endCharIndex <= info.endOffset) {
      endNode = info.node
      endOffset = endCharIndex - info.startOffset
    }
  }

  if (!startNode || !endNode) return null

  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  return range
}

/**
 * Merges all DOMRects on the same line into single rectangles.
 * This creates cleaner highlights when text spans multiple DOM nodes (e.g., LSGS verses
 * where Strong's references create gaps between text nodes).
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
  containerRef: RefObject<HTMLDivElement | null>
  wordAnnotations: WebViewProps['wordAnnotations']
  version: string
  book: number
  chapter: number
  verses: TVerse[]
  settings: RootStyles['settings']
  // Optional: Selection support for annotation mode
  selection?: SelectionRange | null
  getTokens?: (verseKey: string, text: string) => WordToken[]
}

/**
 * Common parameters for calculating highlight rects for a word range within a verse.
 */
interface CalculateRectsParams {
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
  verseKey,
  startWordIndex,
  endWordIndex,
  containerRect,
  tokens,
}: CalculateRectsParams): Array<{ top: number; left: number; width: number; height: number }> {
  const verseEl = document.getElementById(`verse-text-${verseKey}`)
  if (!verseEl) return []

  // Collect all text nodes to handle LSGS/KJVS verses with Strong's refs
  const { fullText, textNodes } = collectTextNodes(verseEl)
  if (!fullText || textNodes.length === 0) return []

  const startToken = getTokenByWordIndex(tokens, startWordIndex)
  const endToken = getTokenByWordIndex(tokens, endWordIndex)
  if (!startToken || !endToken) return []

  try {
    // Create range across potentially multiple text nodes
    const domRange = createRangeAcrossNodes(textNodes, startToken.charStart, endToken.charEnd)
    if (!domRange) return []

    // Merge adjacent rects on same line for cleaner highlights
    const clientRects = mergeRectsOnSameLine(Array.from(domRange.getClientRects()))

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
      verseKey,
      startWordIndex: startWordIdx,
      endWordIndex: endWordIdx,
      containerRect,
      tokens,
    })

    verseRects.forEach((rect, rectIdx) => {
      rects.push({
        id: `selection-${verseKey}-${rectIdx}`,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        color: 'rgba(0, 122, 255, 0.3)',
        type: 'selection',
      })
    })
  })

  return rects
}

type HandlePositions = {
  start: { x: number; y: number } | null
  end: { x: number; y: number } | null
}

const EMPTY_HANDLE_POSITIONS: HandlePositions = { start: null, end: null }

export function useAnnotationHighlights({
  containerRef,
  wordAnnotations,
  version,
  book,
  chapter,
  verses,
  settings,
  selection,
  getTokens,
}: UseAnnotationHighlightsProps): {
  highlightRects: HighlightRect[]
  selectionHandlePositions: HandlePositions
} {
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([])
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

      // Cache tokenization results by verse key to avoid re-tokenizing
      // when multiple annotations reference the same verse
      const tokensByVerse = new Map<string, ReturnType<typeof tokenizeVerseText>>()

      Object.entries(wordAnnotations).forEach(([annotationId, annotation]) => {
        if (annotation.version !== version) return

        annotation.ranges.forEach((range, rangeIdx) => {
          const { verseKey, startWordIndex, endWordIndex } = range

          let tokens = tokensByVerse.get(verseKey)
          if (!tokens) {
            const verseTextEl = document.getElementById(`verse-text-${verseKey}`)
            if (!verseTextEl) return

            const { fullText } = collectTextNodes(verseTextEl)
            if (!fullText) return

            tokens = tokenizeVerseText(fullText)
            tokensByVerse.set(verseKey, tokens)
          }

          const verseRects = calculateRectsForWordRange({
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
            })
          })
        })
      })

      return rects
    }

    const calculateAllRects = (): HighlightRect[] => {
      const annotationRects = calculateAnnotationRects()

      // Add selection rects if we have a selection and getTokens function
      if (selection && getTokens) {
        const selectionRects = getRectsForSelection(containerRef, selection, verses, getTokens)
        return [...annotationRects, ...selectionRects]
      }

      return annotationRects
    }

    requestAnimationFrame(() => {
      const rects = calculateAllRects()
      setHighlightRects(rects)
      if (isChapterChange) {
        setIsPending(false)
      }
    })

    const handleResize = () => {
      requestAnimationFrame(() => {
        const rects = calculateAllRects()
        setHighlightRects(rects)
      })
    }

    // Listen for layout changes (e.g., VerseTags expand/collapse)
    const handleLayoutChanged = () => {
      requestAnimationFrame(() => {
        const rects = calculateAllRects()
        setHighlightRects(rects)
      })
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('layoutChanged', handleLayoutChanged)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('layoutChanged', handleLayoutChanged)
    }
  }, [version, book, chapter, annotationKey, selection, verses, settings])

  // Calculate selection handle positions synchronously from highlight rects
  const selectionHandlePositions = (() => {
    const selectionRects = highlightRects.filter(r => r.type === 'selection')
    if (selectionRects.length === 0) {
      return EMPTY_HANDLE_POSITIONS
    }

    // Read direction from DOM
    const isRTL = containerRef.current
      ? getComputedStyle(containerRef.current).direction === 'rtl'
      : false

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
  })()

  // Return empty array while pending to prevent flash of old positions
  // BUT allow selection to show during isPending (for drag-to-select feedback)
  return {
    highlightRects: isPending && !selection ? [] : highlightRects,
    selectionHandlePositions,
  }
}
