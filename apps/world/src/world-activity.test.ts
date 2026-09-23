import { describe, expect, it } from 'vitest'
import { canAnimateWorld } from './world-activity'

describe('world animation visibility', () => {
  it.each([false, true])('animates a focused visible world (stand=%s)', stand => {
    expect(canAnimateWorld(stand, true, false)).toBe(true)
  })

  it('keeps a visible stand animating after losing focus', () => {
    expect(canAnimateWorld(true, false, false)).toBe(true)
  })

  it('pauses an ordinary world after losing focus', () => {
    expect(canAnimateWorld(false, false, false)).toBe(false)
  })

  it.each([false, true])('pauses a hidden world (stand=%s)', stand => {
    expect(canAnimateWorld(stand, false, true)).toBe(false)
    expect(canAnimateWorld(stand, true, true)).toBe(false)
  })
})
