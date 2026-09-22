import { describe, expect, it } from 'vitest'
import { AssetReveal } from './asset-reveal'

describe('lazy artwork reveal', () => {
  it('starts transparent and fades only while visible, without replaying on return', () => {
    const reveal = new AssetReveal()
    expect(reveal.update(0, true, false)).toBe(0)
    expect(reveal.update(5000, false, false)).toBe(0)
    const first = reveal.update(50, true, false)
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(1)
    expect(reveal.update(50, false, false)).toBe(first)
    for (let frame = 0; frame < 6; frame++) reveal.update(50, true, false)
    expect(reveal.update(16, true, false)).toBe(1)
    expect(reveal.update(1000, false, false)).toBe(1)
  })
  it('respects reduced motion and clamps background-tab frame gaps', () => {
    expect(new AssetReveal().update(0, true, true)).toBe(1)
    expect(new AssetReveal().update(5000, true, false)).toBeLessThan(0.1)
    expect(new AssetReveal().update(Number.NaN, true, false)).toBe(0)
  })
})
