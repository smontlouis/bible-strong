import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import AnimatedVerseHeight from '../AnimatedVerseHeight.web'

it('tracks intrinsic content height and disconnects when removed', () => {
  const original = globalThis.ResizeObserver
  let resize: () => void = () => {}
  let height = 160
  const disconnect = jest.fn()
  const observe = jest.fn()
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe = observe
      disconnect = disconnect
    },
  })
  let view: ReactTestRenderer | undefined
  try {
    act(() => {
      view = create(
        <AnimatedVerseHeight>
          <span>Verse</span>
        </AnimatedVerseHeight>,
        {
          createNodeMock: () => ({ getBoundingClientRect: () => ({ height }) }),
        }
      )
    })
    expect(view!.root.findByProps({ className: 'bs-home-verse-height' }).props.style.height).toBe(
      160
    )
    height = 245.2
    act(() => resize())
    expect(view!.root.findByProps({ className: 'bs-home-verse-height' }).props.style.height).toBe(
      246
    )
    expect(observe).toHaveBeenCalledTimes(1)
  } finally {
    act(() => view?.unmount())
    globalThis.ResizeObserver = original
  }
  expect(disconnect).toHaveBeenCalledTimes(1)
})
