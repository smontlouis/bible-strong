import { describe, expect, it } from 'vitest'
import {
  MAX_CAMERA_ZOOM,
  cameraZoomBounds,
  clampCameraZoom,
  zoomFromPinch,
  zoomFromWheel,
} from './camera-zoom'

const boundsFor = (width: number, height: number) =>
  cameraZoomBounds(width, height, 2071, 1341, 941)

describe('camera zoom', () => {
  it.each([
    [390, 844],
    [844, 390],
    [1440, 900],
    [2880, 1800],
  ])('uses the exact overview framing as the minimum at %i × %i', (width, height) => {
    const { base, overview, minimum } = boundsFor(width, height)
    expect(base * clampCameraZoom(-100, minimum)).toBeCloseTo(overview)
    expect(2071 * overview).toBeLessThanOrEqual(width)
    expect(1341 * overview).toBeLessThanOrEqual(height)
    expect(zoomFromWheel(1, 10_000, minimum)).toBe(minimum)
    expect(zoomFromPinch(1, 100, 1, minimum)).toBe(minimum)
  })

  it('keeps the upper limit and adapts the lower limit to the screen', () => {
    const phone = boundsFor(390, 844).minimum
    const desktop = boundsFor(1440, 900).minimum
    expect(phone).toBeLessThan(desktop)
    expect(clampCameraZoom(phone, desktop)).toBe(desktop)
    expect(clampCameraZoom(1.25, phone)).toBe(1.25)
    expect(clampCameraZoom(8, phone)).toBe(MAX_CAMERA_ZOOM)
  })

  it('zooms smoothly from the overview boundary without jumping to the previous zoom', () => {
    const { minimum } = boundsFor(390, 844)
    expect(zoomFromWheel(minimum, 120, minimum)).toBe(minimum)
    expect(zoomFromWheel(minimum, -1, minimum)).toBeGreaterThan(minimum)
    expect(zoomFromWheel(minimum, -1, minimum)).toBeLessThan(minimum + 0.01)
    expect(zoomFromPinch(minimum, 100, 101, minimum)).toBeCloseTo(minimum * 1.01)
    expect(zoomFromWheel(1, -10_000, minimum)).toBe(MAX_CAMERA_ZOOM)
  })

  it('uses the distance ratio of a two-finger pinch', () => {
    const { minimum } = boundsFor(390, 844)
    expect(zoomFromPinch(1, 100, 150, minimum)).toBe(1.5)
    expect(zoomFromPinch(1.5, 100, 50, minimum)).toBe(0.75)
    expect(zoomFromPinch(1, 0, 200, minimum)).toBe(1)
  })
})
