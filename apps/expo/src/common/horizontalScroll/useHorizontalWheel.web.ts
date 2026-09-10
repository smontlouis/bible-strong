import { useEffect, useState } from 'react'
import { horizontalWheelDelta } from './wheelDelta'

export function useHorizontalWheel(element: HTMLElement | null) {
  const [edges, setEdges] = useState({ left: false, right: false })
  useEffect(() => {
    if (!element) return
    const rtl = getComputedStyle(element).direction === 'rtl'
    const position = () => (rtl ? -element.scrollLeft : element.scrollLeft)
    const update = () => {
      const extent = Math.max(0, element.scrollWidth - element.clientWidth)
      const start = position() > 1
      const end = position() < extent - 1
      const next = { left: rtl ? end : start, right: rtl ? start : end }
      setEdges(previous =>
        previous.left === next.left && previous.right === next.right ? previous : next
      )
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.cancelable || event.defaultPrevented) return
      const delta = horizontalWheelDelta(event, {
        position: position(),
        extent: Math.max(0, element.scrollWidth - element.clientWidth),
        viewport: element.clientWidth,
        lineHeight: parseFloat(getComputedStyle(element).lineHeight) || 16,
      })
      if (!delta) return
      event.preventDefault()
      event.stopPropagation()
      element.scrollLeft += rtl ? -delta : delta
      update()
    }
    const observer = new ResizeObserver(update)
    const observe = () => {
      observer.disconnect()
      observer.observe(element)
      if (element.firstElementChild) observer.observe(element.firstElementChild)
      update()
    }
    const mutations = new MutationObserver(observe)
    mutations.observe(element, { childList: true, subtree: true })
    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('scroll', update, { passive: true })
    observe()
    return () => {
      observer.disconnect()
      mutations.disconnect()
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('scroll', update)
    }
  }, [element])
  const scroll = (direction: -1 | 1) => {
    if (!element) return
    element.scrollBy({
      left: direction * Math.max(80, element.clientWidth * 0.7),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }
  return { ...edges, scroll }
}
