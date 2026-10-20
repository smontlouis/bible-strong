export const BIBLE_LAYOUT_CHANGED_EVENT = 'layoutChanged'

type BibleLayoutEventTarget = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener' | 'dispatchEvent'
>

export const notifyBibleLayoutChanged = (eventTarget: BibleLayoutEventTarget = window) => {
  eventTarget.dispatchEvent(new Event(BIBLE_LAYOUT_CHANGED_EVENT))
}

export const subscribeToBibleLayoutChanges = (
  listener: EventListener,
  eventTarget: BibleLayoutEventTarget = window
) => {
  eventTarget.addEventListener(BIBLE_LAYOUT_CHANGED_EVENT, listener)

  return () => {
    eventTarget.removeEventListener(BIBLE_LAYOUT_CHANGED_EVENT, listener)
  }
}

// The overlay comes back at the latest this long after a layout animation starts
export const MAX_LAYOUT_ANIMATION_MS = 1000
// Motion applies its first FLIP transform within a frame or two of announcing the animation
const MIN_WATCHED_FRAMES = 2

type VersePositionLayoutOptions = {
  eventTarget?: BibleLayoutEventTarget
  // The transform Motion writes on the animated element: empty or 'none' at rest
  getTransform: () => string | null | undefined
  onAnimationStart: () => void
  onAnimationSettled: () => void
  requestFrame?: (callback: FrameRequestCallback) => unknown
  now?: () => number
}

const isTransformAtRest = (transform: string | null | undefined) =>
  !transform || transform === 'none'

/**
 * Motion uses FLIP transforms for position layout animations. DOM ranges measured
 * while that transform is active reflect the visual starting position, so the
 * annotation overlay stays hidden until it has been measured again after the
 * transform settles.
 *
 * Motion does not call onLayoutAnimationComplete when it cuts an animation short (a new
 * layout measurement without any change finishes it silently), so the element's transform
 * is watched as well: the overlay comes back once the transform is gone, or after
 * MAX_LAYOUT_ANIMATION_MS at the latest. The props hold that state: create them once
 * per animated element.
 */
export const createVersePositionLayoutProps = ({
  eventTarget = window,
  getTransform,
  onAnimationStart,
  onAnimationSettled,
  requestFrame = requestAnimationFrame,
  now = () => performance.now(),
}: VersePositionLayoutOptions) => {
  // Each animation start begins a new generation: work left over from an older one is dropped
  let generation = 0
  let isWatching = false

  const settle = () => {
    isWatching = false
    const settledGeneration = generation
    requestFrame(() => {
      if (settledGeneration !== generation) return
      notifyBibleLayoutChanged(eventTarget)
      requestFrame(() => {
        if (settledGeneration === generation) onAnimationSettled()
      })
    })
  }

  const watchTransform = (
    watchedGeneration: number,
    startedAt: number,
    watchedFrames: number,
    hasSeenTransform: boolean
  ) => {
    requestFrame(() => {
      if (watchedGeneration !== generation || !isWatching) return

      const isAtRest = isTransformAtRest(getTransform())
      const frames = watchedFrames + 1
      if (
        (isAtRest && (hasSeenTransform || frames >= MIN_WATCHED_FRAMES)) ||
        now() - startedAt >= MAX_LAYOUT_ANIMATION_MS
      ) {
        settle()
        return
      }
      watchTransform(watchedGeneration, startedAt, frames, hasSeenTransform || !isAtRest)
    })
  }

  return {
    layout: 'position' as const,
    onLayoutAnimationStart: () => {
      generation += 1
      isWatching = true
      onAnimationStart()
      watchTransform(generation, now(), 0, false)
    },
    onLayoutAnimationComplete: () => {
      if (isWatching) settle()
    },
  }
}
