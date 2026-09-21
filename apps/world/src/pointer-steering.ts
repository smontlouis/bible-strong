import type { Point } from './world'

export const POINTER_HOLD_MS = 200
export type PointerPress = {
  id: number
  screen: Point
  origin: Point
  startedAt: number
  dragged: boolean
}

export function isPointerSteering(press: PointerPress, now: number) {
  return press.dragged || now - press.startedAt >= POINTER_HOLD_MS
}

/** Pixel-based speed keeps the same feel across camera zooms and screen densities. */
export function pointerDirection(offset: Point, pixelsPerWorldUnit: Point): Point {
  const pixels = Math.hypot(offset.x * pixelsPerWorldUnit.x, offset.y * pixelsPerWorldUnit.y)
  const length = Math.hypot(offset.x, offset.y)
  if (pixels <= 15 || length === 0) return { x: 0, y: 0 }
  const speed = Math.min(1, pixels / 120)
  return { x: offset.x / length * speed, y: offset.y / length * speed }
}
