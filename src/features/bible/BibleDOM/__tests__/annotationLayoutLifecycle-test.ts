import {
  createVersePositionLayoutProps,
  subscribeToBibleLayoutChanges,
} from '../annotationLayoutLifecycle'

describe('annotation layout lifecycle', () => {
  it('hides overlays during motion, recalculates, then reveals them on the next frame', () => {
    const listener = jest.fn()
    const onAnimationStart = jest.fn()
    const onAnimationSettled = jest.fn()
    const eventTarget = new EventTarget()
    const frames: FrameRequestCallback[] = []
    const layoutProps = createVersePositionLayoutProps({
      eventTarget,
      onAnimationStart,
      onAnimationSettled,
      requestFrame: callback => frames.push(callback),
    })
    const unsubscribe = subscribeToBibleLayoutChanges(listener, eventTarget)

    layoutProps.onLayoutAnimationStart()
    expect(onAnimationStart).toHaveBeenCalledTimes(1)

    layoutProps.onLayoutAnimationComplete()
    expect(layoutProps.layout).toBe('position')
    expect(listener).not.toHaveBeenCalled()
    expect(onAnimationSettled).not.toHaveBeenCalled()

    frames.shift()?.(0)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(onAnimationSettled).not.toHaveBeenCalled()

    frames.shift()?.(0)
    expect(onAnimationSettled).toHaveBeenCalledTimes(1)

    unsubscribe()
  })
})
