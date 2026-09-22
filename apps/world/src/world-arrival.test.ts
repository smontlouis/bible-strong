import { describe, expect, it } from 'vitest'
import { arrivalZoom } from './world-arrival'

describe('world arrival', () => {
  it('holds the distant view during loading and the first 500 ms of the reveal', () => {
    expect(arrivalZoom(null, 50_000, 0.2, 2)).toBe(0.2)
    expect(arrivalZoom(50_000, 50_000, 0.2, 2)).toBe(0.2)
    expect(arrivalZoom(50_000, 50_499, 0.2, 2)).toBe(0.2)
    expect(arrivalZoom(50_000, 50_500, 0.2, 2)).toBe(0.2)
  })

  it.each([1.75, 2])('approaches zoom %s smoothly and releases camera controls after 2.5 seconds', target => {
    expect(arrivalZoom(1000, 1750, 0.2, target)).toBeCloseTo(0.2 + (target - 0.2) * 0.028)
    expect(arrivalZoom(1000, 2750, 0.2, target)).toBeCloseTo((0.2 + target) / 2)
    expect(arrivalZoom(1000, 3999, 0.2, target)).toBeCloseTo(target)
    expect(arrivalZoom(1000, 4000, 0.2, target)).toBeUndefined()
    expect(arrivalZoom(1000, 5000, 0.2, target)).toBeUndefined()
    expect(arrivalZoom(undefined, 0, 0.2, target)).toBeUndefined()
  })
})
