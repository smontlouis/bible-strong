import { describe, expect, it } from 'vitest'
import { projectCloud } from './cloud-parallax'

const camera = { width: 1280, height: 720, scrollX: 195.5, scrollY: 110.5, zoom: 0.8 }
const screenX = (x: number, view: typeof camera) =>
  (x - view.scrollX - view.width / 2) * view.zoom + view.width / 2

describe('cloud parallax', () => {
  it('increases relative pan speed as the camera approaches the clouds', () => {
    const relativeSpeed = (zoom: number) => {
      const view = { ...camera, zoom }
      const moved = { ...view, scrollX: view.scrollX + 100 }
      const before = projectCloud(900, 400, view)
      const after = projectCloud(900, 400, moved)
      return Math.abs(screenX(after.x, moved) - screenX(before.x, view)) / (100 * zoom)
    }
    expect(relativeSpeed(0.4)).toBeGreaterThan(1)
    expect(relativeSpeed(0.8)).toBeGreaterThan(relativeSpeed(0.4))
    expect(relativeSpeed(1.6)).toBeGreaterThan(relativeSpeed(0.8))
  })

  it('moves foreground clouds faster than the ground when the camera pans', () => {
    const moved = { ...camera, scrollX: camera.scrollX + 100 }
    const before = projectCloud(900, 400, camera)
    const after = projectCloud(900, 400, moved)
    expect(screenX(after.x, moved) - screenX(before.x, camera)).toBeCloseTo(-116)
  })

  it('zooms cloud size and position together, faster than the ground', () => {
    const zoomed = { ...camera, zoom: 1.6 }
    const before = projectCloud(1000, 400, camera)
    const after = projectCloud(1000, 400, zoomed)
    const ratio = (2 * 1.9) / 1.45
    expect(after.scale * zoomed.zoom / (before.scale * camera.zoom)).toBeCloseTo(ratio)
    expect((screenX(after.x, zoomed) - 640) / (screenX(before.x, camera) - 640)).toBeCloseTo(ratio)
  })
})
