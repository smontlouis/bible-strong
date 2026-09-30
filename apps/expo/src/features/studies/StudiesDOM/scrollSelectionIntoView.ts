import type { QuillInstance, QuillRange } from './quill-types'

const SCROLL_MARGIN = 24
// Returning from the Bible, the sheet and keyboard squeeze the webview (down to 0px)
// before it grows back: measure again on each resize until the layout has settled.
const VIEWPORT_SETTLE_MS = 1200
// Below this height the viewport is mid-transition and its geometry is meaningless.
const MIN_VISIBLE_HEIGHT = 80
// Wait for resizes to pause so intermediate animation frames don't make the page jump.
const RESIZE_DEBOUNCE_MS = 150

const isScrollable = (element: HTMLElement): boolean => {
  const { overflowY } = window.getComputedStyle(element)
  return (
    (overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight
  )
}

const getScrollParent = (element: HTMLElement): HTMLElement | null => {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (isScrollable(parent)) return parent
  }
  return null
}

const getVisibleArea = (scrollParent: HTMLElement | null) => {
  const viewport = window.visualViewport
  const viewTop = viewport?.offsetTop ?? 0
  const viewBottom = viewTop + (viewport?.height ?? window.innerHeight)
  if (!scrollParent) return { top: viewTop, bottom: viewBottom }

  const rect = scrollParent.getBoundingClientRect()
  return { top: Math.max(rect.top, viewTop), bottom: Math.min(rect.bottom, viewBottom) }
}

const scrollRangeIntoView = (quill: QuillInstance, range: QuillRange): void => {
  // Quill only scrolls its own root, which never overflows here: the page scrolls instead.
  const bounds = quill.getBounds(range)
  if (!bounds) return

  const containerTop = quill.container.getBoundingClientRect().top
  const top = containerTop + bounds.top - SCROLL_MARGIN
  const bottom = containerTop + bounds.bottom + SCROLL_MARGIN
  const scrollParent = getScrollParent(quill.container)
  const visible = getVisibleArea(scrollParent)
  if (visible.bottom - visible.top < MIN_VISIBLE_HEIGHT) return

  let delta = 0
  if (bottom > visible.bottom) delta = bottom - visible.bottom
  else if (top < visible.top) delta = top - visible.top
  if (!delta) return

  if (scrollParent) scrollParent.scrollBy(0, delta)
  else window.scrollBy(0, delta)
}

/** Brings the inserted content (or the current selection) into view once layout settles. */
export const scrollSelectionIntoView = (quill: QuillInstance, range?: QuillRange): void => {
  const run = () => {
    const target = range ?? quill.getSelection()
    if (target) scrollRangeIntoView(quill, target)
  }

  requestAnimationFrame(run)

  const viewport = window.visualViewport
  if (!viewport) return

  let debounceId: ReturnType<typeof setTimeout> | undefined
  const onResize = () => {
    clearTimeout(debounceId)
    debounceId = setTimeout(run, RESIZE_DEBOUNCE_MS)
  }
  viewport.addEventListener('resize', onResize)
  setTimeout(() => {
    viewport.removeEventListener('resize', onResize)
    clearTimeout(debounceId)
    run()
  }, VIEWPORT_SETTLE_MS)
}
