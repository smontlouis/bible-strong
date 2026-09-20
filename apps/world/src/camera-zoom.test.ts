import { describe, expect, it } from 'vitest'
import {
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
  clampCameraZoom,
  zoomFromPinch,
  zoomFromWheel,
} from './camera-zoom'

describe('camera zoom', () => {
  it('clamps every input to the supported range', () => {
    expect(clampCameraZoom(0.1)).toBe(MIN_CAMERA_ZOOM)
    expect(clampCameraZoom(1.25)).toBe(1.25)
    expect(clampCameraZoom(8)).toBe(MAX_CAMERA_ZOOM)
  })

  it('zooms in and out from a mouse wheel or trackpad', () => {
    expect(zoomFromWheel(1, -120)).toBeGreaterThan(1)
    expect(zoomFromWheel(1, 120)).toBeLessThan(1)
    expect(zoomFromWheel(1, -10_000)).toBe(MAX_CAMERA_ZOOM)
    expect(zoomFromWheel(1, 10_000)).toBe(MIN_CAMERA_ZOOM)
  })

  it('uses the distance ratio of a two-finger pinch', () => {
    expect(zoomFromPinch(1, 100, 150)).toBe(1.5)
    expect(zoomFromPinch(1.5, 100, 50)).toBe(0.75)
    expect(zoomFromPinch(1, 0, 200)).toBe(1)
  })
})
