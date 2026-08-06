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

type VersePositionLayoutOptions = {
  eventTarget?: BibleLayoutEventTarget
  onAnimationStart: () => void
  onAnimationSettled: () => void
  requestFrame?: (callback: FrameRequestCallback) => unknown
}

/**
 * Motion uses FLIP transforms for position layout animations. DOM ranges measured
 * while that transform is active reflect the visual starting position, so the
 * annotation overlay stays hidden until it has been measured again after the
 * transform settles.
 */
export const createVersePositionLayoutProps = ({
  eventTarget = window,
  onAnimationStart,
  onAnimationSettled,
  requestFrame = requestAnimationFrame,
}: VersePositionLayoutOptions) => ({
  layout: 'position' as const,
  onLayoutAnimationStart: onAnimationStart,
  onLayoutAnimationComplete: () => {
    requestFrame(() => {
      notifyBibleLayoutChanged(eventTarget)
      requestFrame(onAnimationSettled)
    })
  },
})
