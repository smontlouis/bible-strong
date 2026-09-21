import { describe, expect, it } from 'vitest'
import { PointerTap } from './pointer-tap'

const origin = { x: 10, y: 20 }
describe('map tap recognition', () => {
  it('accepts a click or tap with small finger movement', () => {
    const tap = new PointerTap()
    tap.start(1, origin, 0)
    expect(tap.end(1, { x: 13, y: 22 }, 150)).toBe(true)
  })
  it('rejects dragging even when the pointer returns to its start', () => {
    const tap = new PointerTap()
    tap.start(1, origin, 0)
    tap.move({ x: 40, y: 20 })
    expect(tap.end(1, origin, 200)).toBe(false)
  })
  it('never turns the last finger of a pinch into a destination', () => {
    const tap = new PointerTap()
    tap.start(1, origin, 0)
    tap.start(2, origin, 30)
    expect(tap.end(1, origin, 120)).toBe(false)
    expect(tap.end(2, origin, 150)).toBe(false)
    tap.start(3, origin, 200)
    expect(tap.end(3, origin, 300)).toBe(true)
  })
  it('rejects long presses, cancellations and gestures interrupted by zoom or blur', () => {
    const tap = new PointerTap()
    tap.start(1, origin, 0)
    expect(tap.end(1, origin, 700)).toBe(false)
    tap.start(1, origin, 800)
    expect(tap.end(1, origin, 900, true)).toBe(false)
    tap.start(1, origin, 1000)
    tap.cancel()
    expect(tap.end(1, origin, 1100)).toBe(false)
    tap.start(1, origin, 1200)
    tap.reset()
    expect(tap.end(1, origin, 1300)).toBe(false)
  })
})
