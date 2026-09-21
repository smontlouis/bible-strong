import { describe, expect, it } from 'vitest'
import { isPointerSteering, pointerDirection, type PointerPress } from './pointer-steering'
import { move, type NavigationDocument } from './world'

const press: PointerPress = {
  id: 1, screen: { x: 10, y: 20 }, origin: { x: 10, y: 20 }, startedAt: 100, dragged: false,
}
const pixels = { x: 1, y: 1 }
describe('held pointer steering', () => {
  it('leaves quick clicks to pathfinding and starts steering on hold or drag', () => {
    expect(isPointerSteering(press, 299)).toBe(false)
    expect(isPointerSteering(press, 300)).toBe(true)
    expect(isPointerSteering({ ...press, dragged: true }, 110)).toBe(true)
  })
  it('stops near the avatar and increases speed with pointer distance', () => {
    expect(pointerDirection({ x: 10, y: 0 }, pixels)).toEqual({ x: 0, y: 0 })
    expect(pointerDirection({ x: 30, y: 0 }, pixels)).toEqual({ x: 0.25, y: 0 })
    expect(pointerDirection({ x: 60, y: 0 }, pixels)).toEqual({ x: 0.5, y: 0 })
    expect(pointerDirection({ x: 240, y: 0 }, pixels)).toEqual({ x: 1, y: 0 })
  })
  it('keeps diagonal speed bounded and follows pointer direction', () => {
    const direction = pointerDirection({ x: -120, y: 120 }, pixels)
    expect(direction.x).toBeLessThan(0)
    expect(direction.y).toBeGreaterThan(0)
    expect(Math.hypot(direction.x, direction.y)).toBeCloseTo(1)
  })
  it('keeps speed consistent at different zooms and rendering densities', () => {
    expect(pointerDirection({ x: 30, y: 0 }, { x: 2, y: 2 })).toEqual(pointerDirection({ x: 60, y: 0 }, pixels))
  })
  it('produces slower actual movement through the ordinary collision solver', () => {
    const navigation: NavigationDocument = {
      version: 1, map: 'archipelago', width: 200, height: 200,
      zones: [{ id: 'floor', name: 'Floor', kind: 'allowed', points: [[0, 0], [200, 0], [200, 200], [0, 200]] }],
    }
    const start = { x: 50, y: 50 }
    const slow = move(start, pointerDirection({ x: 30, y: 0 }, pixels), 0.05, navigation)
    const fast = move(start, pointerDirection({ x: 120, y: 0 }, pixels), 0.05, navigation)
    expect(slow.x - start.x).toBeCloseTo((fast.x - start.x) / 4)
    expect(move(start, pointerDirection({ x: 0, y: 0 }, pixels), 0.05, navigation)).toEqual(start)
  })
})
