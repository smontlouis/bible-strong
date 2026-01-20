'use dom'

import { useEffect, useState, RefObject } from 'react'
import { Verse as TVerse } from '~common/types'
import { tokenizeVerseText, getTokenByWordIndex } from '~helpers/wordTokenizer'
import { RootStyles, WebViewProps } from '../BibleDOMWrapper'
import { HighlightRect, AnnotationType } from './HighlightComponents'

interface UseAnnotationHighlightsProps {
  containerRef: RefObject<HTMLDivElement | null>
  wordAnnotations: WebViewProps['wordAnnotations']
  version: string
  verses: TVerse[]
  settings: RootStyles['settings']
}

export function useAnnotationHighlights({
  containerRef,
  wordAnnotations,
  version,
  verses,
  settings,
}: UseAnnotationHighlightsProps) {
  const [highlightRects, setHighlightRects] = useState<HighlightRect[]>([])

  useEffect(() => {
    if (!wordAnnotations || !containerRef.current) {
      setHighlightRects([])
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

          const textNode = verseTextEl.firstChild
          if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return

          const text = textNode.textContent || ''
          const tokens = tokenizeVerseText(text)
          const startToken = getTokenByWordIndex(tokens, startWordIndex)
          const endToken = getTokenByWordIndex(tokens, endWordIndex)
          if (!startToken || !endToken) return

          try {
            const domRange = document.createRange()
            domRange.setStart(textNode, startToken.charStart)
            domRange.setEnd(textNode, endToken.charEnd)

            const clientRects = domRange.getClientRects()
            const colorValue =
              settings.colors[settings.theme][
                annotation.color as keyof (typeof settings.colors)[typeof settings.theme]
              ] || annotation.color

            Array.from(clientRects).forEach((rect, rectIdx) => {
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
  }, [wordAnnotations, version, verses, settings])

  return highlightRects
}
