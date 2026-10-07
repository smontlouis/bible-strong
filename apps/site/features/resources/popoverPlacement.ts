const SHEET_BREAKPOINT = 640
const POPOVER_WIDTH = 360
const GUTTER = 12

/**
 * Places a `.resource-popover` card under the element that opened it, or above when the
 * page ends below it. A narrow screen gets a sheet at the bottom instead.
 */
export const placePopover = (popover: HTMLElement, anchor: Element) => {
  if (window.innerWidth < SHEET_BREAKPOINT) {
    popover.dataset.placement = 'sheet'
    popover.removeAttribute('style')
    return
  }
  const rect = anchor.getBoundingClientRect()
  const width = Math.min(POPOVER_WIDTH, window.innerWidth - GUTTER * 2)
  const left = Math.min(
    Math.max(GUTTER, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - GUTTER
  )
  const spaceBelow = window.innerHeight - rect.bottom
  popover.dataset.placement = 'anchored'
  popover.style.width = `${width}px`
  popover.style.left = `${left}px`
  if (spaceBelow < 280 && rect.top > spaceBelow) {
    popover.style.top = 'auto'
    popover.style.bottom = `${window.innerHeight - rect.top + 8}px`
  } else {
    popover.style.bottom = 'auto'
    popover.style.top = `${rect.bottom + 8}px`
  }
}

/** An anchored card would drift away from its anchor while the page scrolls. */
export const hideAnchoredPopoverOnScroll = (popover: HTMLElement): (() => void) => {
  const onScroll = () => {
    if (popover.dataset.placement === 'anchored' && popover.matches(':popover-open')) {
      popover.hidePopover()
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => window.removeEventListener('scroll', onScroll)
}
