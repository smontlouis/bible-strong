'use dom'

export type DOMScrollTarget = Window | HTMLElement

const isScrollable = (element: HTMLElement) => {
  const { overflowY } = window.getComputedStyle(element)
  return (
    (overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight
  )
}

export const getDOMScrollTarget = (container: HTMLElement | null): DOMScrollTarget => {
  let ancestor = container?.parentElement ?? null

  while (ancestor && ancestor !== document.body) {
    if (isScrollable(ancestor)) return ancestor
    ancestor = ancestor.parentElement
  }

  return window
}

export const getDOMScrollTop = (target: DOMScrollTarget) =>
  target === window ? window.scrollY : (target as HTMLElement).scrollTop

export const getDOMViewportHeight = (target: DOMScrollTarget) =>
  target === window ? window.innerHeight : (target as HTMLElement).clientHeight

export const getDOMScrollHeight = (target: DOMScrollTarget) =>
  target === window ? document.documentElement.scrollHeight : (target as HTMLElement).scrollHeight

export const scrollDOMTo = (target: DOMScrollTarget, options: ScrollToOptions) =>
  target.scrollTo(options)

export const scrollDOMBy = (target: DOMScrollTarget, options: ScrollToOptions) =>
  target.scrollBy(options)

export const addDOMScrollListener = (target: DOMScrollTarget, listener: EventListener) => {
  target.addEventListener('scroll', listener, { passive: true })
  return () => target.removeEventListener('scroll', listener)
}
