import { useLayoutEffect, useState } from 'react'
// Imports `widePage`, never `useWidePage`: on the Web that name is this very file.
import { WIDE_PAGE_MIN_WIDTH, type WidePage } from './widePage'

export {
  WIDE_PAGE_HEADER_HEIGHT,
  WIDE_PAGE_MAX_WIDTH,
  WIDE_PAGE_MIN_WIDTH,
  type WidePage,
} from './widePage'

/**
 * Measures the page itself, not the window, so a sidebar, a side panel or a second tab beside it
 * bring it back to one column. It watches the page's box: a page often mounts its frame after a
 * loading state, and its width changes whenever a panel opens beside it. The first measure is
 * read before the paint, so a wide page never flashes as a single column.
 */
export const useWidePage = (minWidth = WIDE_PAGE_MIN_WIDTH): WidePage => {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    if (!node) return
    const measure = () => {
      const rect = node.getBoundingClientRect()
      const next = { width: Math.round(rect.width), height: Math.round(rect.height) }
      setFrame(current =>
        current.width === next.width && current.height === next.height ? current : next
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return {
    wide: frame.width >= minWidth,
    height: frame.height,
    ref: setNode as unknown as WidePage['ref'],
  }
}
