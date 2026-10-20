import {
  createVersePositionLayoutProps,
  MAX_LAYOUT_ANIMATION_MS,
  subscribeToBibleLayoutChanges,
} from '../annotationLayoutLifecycle'

const setup = () => {
  const listener = jest.fn()
  const onAnimationStart = jest.fn()
  const onAnimationSettled = jest.fn()
  const eventTarget = new EventTarget()
  let frames: FrameRequestCallback[] = []
  let time = 0
  const element = { transform: '' }
  const layoutProps = createVersePositionLayoutProps({
    eventTarget,
    getTransform: () => element.transform,
    onAnimationStart,
    onAnimationSettled,
    requestFrame: callback => frames.push(callback),
    now: () => time,
  })
  subscribeToBibleLayoutChanges(listener, eventTarget)

  // Runs the callbacks queued for the next frame, 16 ms later
  const runFrame = () => {
    time += 16
    const queued = frames
    frames = []
    queued.forEach(callback => callback(time))
  }
  const advanceTime = (ms: number) => {
    time += ms
  }

  return {
    advanceTime,
    element,
    layoutProps,
    listener,
    onAnimationSettled,
    onAnimationStart,
    runFrame,
  }
}

describe('annotation layout lifecycle', () => {
  it('hides overlays during motion, recalculates, then reveals them on the next frame', () => {
    const { element, layoutProps, listener, onAnimationSettled, onAnimationStart, runFrame } =
      setup()

    layoutProps.onLayoutAnimationStart()
    expect(onAnimationStart).toHaveBeenCalledTimes(1)
    element.transform = 'translateY(-40px)'
    runFrame()

    layoutProps.onLayoutAnimationComplete()
    expect(layoutProps.layout).toBe('position')
    expect(listener).not.toHaveBeenCalled()
    expect(onAnimationSettled).not.toHaveBeenCalled()

    runFrame()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(onAnimationSettled).not.toHaveBeenCalled()

    runFrame()
    expect(onAnimationSettled).toHaveBeenCalledTimes(1)
  })

  it('reveals overlays once the transform is gone when Motion cuts the animation short', () => {
    const { element, layoutProps, listener, onAnimationSettled, runFrame } = setup()

    layoutProps.onLayoutAnimationStart()
    element.transform = 'translateY(-40px)'
    runFrame()
    runFrame()
    expect(listener).not.toHaveBeenCalled()

    // Motion finishes the animation without calling onLayoutAnimationComplete
    element.transform = 'none'
    runFrame()
    runFrame()
    expect(listener).toHaveBeenCalledTimes(1)

    runFrame()
    expect(onAnimationSettled).toHaveBeenCalledTimes(1)
  })

  it('waits for Motion to apply its first transform before trusting a transform at rest', () => {
    const { element, layoutProps, listener, runFrame } = setup()

    layoutProps.onLayoutAnimationStart()
    runFrame()
    element.transform = 'translateY(-40px)'
    runFrame()
    runFrame()
    expect(listener).not.toHaveBeenCalled()
  })

  it('reveals overlays after the safety delay even if a transform remains', () => {
    const { advanceTime, element, layoutProps, listener, onAnimationSettled, runFrame } = setup()

    layoutProps.onLayoutAnimationStart()
    element.transform = 'translateY(-40px)'
    runFrame()
    expect(listener).not.toHaveBeenCalled()

    advanceTime(MAX_LAYOUT_ANIMATION_MS)
    runFrame()
    runFrame()
    runFrame()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(onAnimationSettled).toHaveBeenCalledTimes(1)
  })

  it('keeps overlays hidden when a new animation starts before they are revealed', () => {
    const { element, layoutProps, listener, onAnimationSettled, runFrame } = setup()

    layoutProps.onLayoutAnimationStart()
    element.transform = 'translateY(-40px)'
    runFrame()
    layoutProps.onLayoutAnimationComplete()

    layoutProps.onLayoutAnimationStart()
    runFrame()
    runFrame()
    expect(listener).not.toHaveBeenCalled()
    expect(onAnimationSettled).not.toHaveBeenCalled()

    layoutProps.onLayoutAnimationComplete()
    runFrame()
    runFrame()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(onAnimationSettled).toHaveBeenCalledTimes(1)
  })
})
