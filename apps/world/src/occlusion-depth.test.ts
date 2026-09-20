import { describe, expect, it } from 'vitest'
import { occlusionDepth } from './occlusion-depth'

describe('dictionary desk ground depth', () => {
  it('keeps an avatar in front along the rising right-hand edge', () => {
    for (const avatar of [{ x: 310, y: 315 }, { x: 350, y: 306 }, { x: 385, y: 299 }]) {
      expect(occlusionDepth('dictionary-desk', 308, avatar.x)).toBeLessThan(avatar.y)
      expect(occlusionDepth('dictionary-reader', 308.1, avatar.x)).toBeLessThan(avatar.y)
    }
  })

  it('still hides the avatar behind the desk and keeps the reader above it', () => {
    for (const x of [246, 280, 300, 350, 394]) {
      const desk = occlusionDepth('dictionary-desk', 308, x)
      expect(desk).toBeGreaterThan(280)
      expect(occlusionDepth('dictionary-reader', 308.1, x)).toBeCloseTo(desk + 0.1)
    }
  })

  it('clamps beyond the desk and preserves other objects', () => {
    expect(occlusionDepth('dictionary-desk', 308, 0)).toBe(285)
    expect(occlusionDepth('dictionary-desk', 308, 1671)).toBe(293)
    expect(occlusionDepth('lexicon-desk', 254, 350)).toBe(254)
  })
})
