import { describe, expect, it } from 'vitest'
import { visibleWaterDecorations, WATER_VARIANTS } from './water-decorations'
import { WIDTH, HEIGHT } from './world'

describe('water scenery', () => {
  const wideView = { x: -2500, y: -2500, width: 6500, height: 6000 }

  it('keeps the same objects when the camera leaves and returns, including negative coordinates', () => {
    const first = visibleWaterDecorations(wideView)
    const shifted = visibleWaterDecorations({ ...wideView, x: -1800, y: -1700 })
    const byKey = new Map(first.map(item => [item.key, item]))
    const shared = shifted.filter(item => byKey.has(item.key))
    expect(shared.length).toBeGreaterThan(10)
    for (const item of shared) expect(item).toEqual(byKey.get(item.key))
    expect(visibleWaterDecorations(wideView)).toEqual(first)
    expect(first.some(item => item.x < 0 && item.y < 0)).toBe(true)
    expect(new Set(first.map(item => item.key)).size).toBe(first.length)
    expect(new Set(first.map(item => item.variant))).toEqual(new Set(WATER_VARIANTS))
  })

  it('keeps every full sprite clear of the map and its generated perimeter', () => {
    for (const item of visibleWaterDecorations(wideView)) {
      const radius = item.size / 2
      expect(
        item.x + radius <= -115 ||
          item.x - radius >= WIDTH + 115 ||
          item.y + radius <= -115 ||
          item.y - radius >= HEIGHT + 115
      ).toBe(true)
    }
  })

  it('keeps large portrait views sparse and bounded', () => {
    const items = visibleWaterDecorations({ x: -200, y: -1900, width: 2071, height: 4500 })
    expect(items.length).toBeGreaterThan(5)
    expect(items.length).toBeLessThan(80)
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        expect(Math.hypot(items[i].x - items[j].x, items[i].y - items[j].y)).toBeGreaterThan(
          (items[i].size + items[j].size) / 2
        )
      }
    }
  })
})
