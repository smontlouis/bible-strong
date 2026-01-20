'use dom'

import { useEffect, DependencyList } from 'react'
import { HighlightRect } from './HighlightComponents'

/**
 * Hook that handles window scroll and resize events to recalculate highlight rectangles.
 * Consolidates the three separate effects from the original component into one.
 */
export function useWindowEvents(
  calculateHighlightRects: () => HighlightRect[],
  setHighlightRects: (rects: HighlightRect[]) => void,
  deps: DependencyList
): void {
  // Initial calculation and deps change
  useEffect(() => {
    const rects = calculateHighlightRects()
    setHighlightRects(rects)
  }, deps)

  // Scroll handler with RAF throttling
  useEffect(() => {
    let rafId: number | null = null

    const handleScroll = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        const rects = calculateHighlightRects()
        setHighlightRects(rects)
        rafId = null
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, deps)

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const rects = calculateHighlightRects()
      setHighlightRects(rects)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, deps)
}
