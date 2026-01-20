'use dom'

import { RefObject, useEffect, useState } from 'react'
import { Verse as TVerse } from '~common/types'
import { getTokenByWordIndex, tokenizeVerseText } from '~helpers/wordTokenizer'
import { RootStyles, WebViewProps } from '../BibleDOMWrapper'
import { AnnotationType, HighlightRect } from './HighlightComponents'

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
}

export function useAnnotationHighlights({
  containerRef,
  wordAnnotations,
  version,
  book,
  chapter,
  verses,
  settings,
}: UseAnnotationHighlightsProps) {
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

  useEffect(() => {
    // Mark as pending immediately when deps change
    setIsPending(true)

    if (!wordAnnotations || !containerRef.current) {
      setHighlightRects([])
      setIsPending(false)
      return
    }

    const calculateRects = (): HighlightRect[] => {
      const rects: HighlightRect[] = []
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return rects

      Object.entries(wordAnnotations).forEach(([annotationId, annotation]) => {
        if (annotation.version !== version) return

        annotation.ranges.forEach((range, rangeIdx) => {
          const { verseKey, startWordIndex, endWordIndex } = range
          const verseTextEl = document.getElementById(`verse-text-${verseKey}`)
          if (!verseTextEl) return

          // Collect all text nodes to handle LSGS/KJVS verses with Strong's refs
          const { fullText, textNodes } = collectTextNodes(verseTextEl)
          if (!fullText || textNodes.length === 0) return

          const tokens = tokenizeVerseText(fullText)
          const startToken = getTokenByWordIndex(tokens, startWordIndex)
          const endToken = getTokenByWordIndex(tokens, endWordIndex)

          if (!startToken || !endToken) return

          try {
            // Create range across potentially multiple text nodes
            const domRange = createRangeAcrossNodes(
              textNodes,
              startToken.charStart,
              endToken.charEnd
            )
            if (!domRange) return

            // Merge adjacent rects on same line for cleaner highlights
            const clientRects = mergeRectsOnSameLine(Array.from(domRange.getClientRects()))
            const colorValue =
              settings.colors[settings.theme][
                annotation.color as keyof (typeof settings.colors)[typeof settings.theme]
              ] || annotation.color

            clientRects.forEach((rect, rectIdx) => {
              rects.push({
                id: `${annotationId}-${rangeIdx}-${rectIdx}`,
                top: rect.top - containerRect.top,
                left: rect.left - containerRect.left,
                width: rect.width,
                height: rect.height,
                color: colorValue as string,
                type: 'annotation',
                annotationType: annotation.type as AnnotationType,
                annotationId,
              })
            })
          } catch (e) {
            console.error('[Bible] Error calculating annotation rects:', e)
          }
        })
      })

      return rects
    }

    requestAnimationFrame(() => {
      const rects = calculateRects()

      setHighlightRects(rects)
      setIsPending(false)
    })

    const handleResize = () => {
      requestAnimationFrame(() => {
        const rects = calculateRects()
        setHighlightRects(rects)
      })
    }

    // Listen for layout changes (e.g., VerseTags expand/collapse)
    const handleLayoutChanged = () => {
      requestAnimationFrame(() => {
        const rects = calculateRects()
        setHighlightRects(rects)
      })
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('layoutChanged', handleLayoutChanged)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('layoutChanged', handleLayoutChanged)
    }
  }, [version, book, chapter, annotationKey])

  // Return empty array while pending to prevent flash of old positions
  return isPending ? [] : highlightRects
}
