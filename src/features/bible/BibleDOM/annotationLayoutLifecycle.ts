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

/**
 * Motion uses FLIP transforms for position layout animations. DOM ranges measured
 * while that transform is active reflect the visual starting position, so the
 * annotation overlay must be measured again after the transform settles.
 */
export const createVersePositionLayoutProps = (eventTarget: BibleLayoutEventTarget) => ({
  layout: 'position' as const,
  onLayoutAnimationComplete: () => notifyBibleLayoutChanged(eventTarget),
})

export const VERSE_POSITION_LAYOUT_PROPS = {
  layout: 'position' as const,
  onLayoutAnimationComplete: () => notifyBibleLayoutChanged(),
}
