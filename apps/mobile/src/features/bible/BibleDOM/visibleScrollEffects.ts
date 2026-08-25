export type VisibleScrollEffectMetrics = {
  scrollY: number
  elementTop: number
  elementBottom: number
  viewportHeight: number
  headerHeight: number
}

type VisibleScrollEffect = (metrics: VisibleScrollEffectMetrics) => void

export const ENABLE_VISIBLE_SCROLL_EFFECTS = false

const effects = new Map<HTMLElement, VisibleScrollEffect>()
const visibleElements = new Set<HTMLElement>()

let observer: IntersectionObserver | null = null
let animationFrame: number | null = null
let isListeningToScroll = false

const readHeaderHeight = () =>
  Number.parseFloat(document.documentElement.style.getPropertyValue('--header-height')) || 0

const updateVisibleEffects = () => {
  animationFrame = null
  const scrollY = window.scrollY
  const viewportHeight = window.innerHeight
  const headerHeight = readHeaderHeight()

  visibleElements.forEach(element => {
    const effect = effects.get(element)
    if (!effect) return

    const rect = element.getBoundingClientRect()
    effect({
      scrollY,
      elementTop: rect.top,
      elementBottom: rect.bottom,
      viewportHeight,
      headerHeight,
    })
  })
}

const scheduleVisibleEffectsUpdate = () => {
  if (animationFrame !== null) return
  animationFrame = requestAnimationFrame(updateVisibleEffects)
}

const handleScroll = () => scheduleVisibleEffectsUpdate()

const syncScrollListener = () => {
  const shouldListen = visibleElements.size > 0
  if (shouldListen === isListeningToScroll) return

  isListeningToScroll = shouldListen
  if (shouldListen) {
    window.addEventListener('scroll', handleScroll, { passive: true })
    scheduleVisibleEffectsUpdate()
  } else {
    window.removeEventListener('scroll', handleScroll)
  }
}

const getObserver = () => {
  if (observer) return observer

  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const element = entry.target as HTMLElement
      if (entry.isIntersecting && effects.has(element)) visibleElements.add(element)
      else visibleElements.delete(element)
    })
    syncScrollListener()
  })

  return observer
}

export const registerVisibleScrollEffect = (element: HTMLElement, effect: VisibleScrollEffect) => {
  if (!ENABLE_VISIBLE_SCROLL_EFFECTS) return () => undefined

  effects.set(element, effect)
  getObserver().observe(element)

  return () => {
    observer?.unobserve(element)
    effects.delete(element)
    visibleElements.delete(element)
    syncScrollListener()

    if (!effects.size) {
      observer?.disconnect()
      observer = null
      if (animationFrame !== null) cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
  }
}
