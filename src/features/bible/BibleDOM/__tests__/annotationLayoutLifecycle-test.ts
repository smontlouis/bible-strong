import {
  createVersePositionLayoutProps,
  subscribeToBibleLayoutChanges,
} from '../annotationLayoutLifecycle'

describe('annotation layout lifecycle', () => {
  it('notifies annotation overlays when the animated verse position settles', () => {
    const listener = jest.fn()
    const eventTarget = new EventTarget()
    const layoutProps = createVersePositionLayoutProps(eventTarget)
    const unsubscribe = subscribeToBibleLayoutChanges(listener, eventTarget)

    layoutProps.onLayoutAnimationComplete()

    expect(layoutProps.layout).toBe('position')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    layoutProps.onLayoutAnimationComplete()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
