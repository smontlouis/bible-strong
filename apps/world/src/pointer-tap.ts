import type { Point } from './world'

/** A tap must stay short and still, and never belong to a multi-pointer gesture. */
export class PointerTap {
  private active = new Set<number>()
  private candidate?: { id: number; point: Point; time: number }

  start(id: number, point: Point, time: number) {
    this.active.add(id)
    this.candidate = this.active.size === 1 ? { id, point, time } : undefined
  }

  move(point: Point) {
    if (this.candidate && Math.hypot(point.x - this.candidate.point.x, point.y - this.candidate.point.y) > 8) {
      this.candidate = undefined
    }
  }

  end(id: number, point: Point, time: number, cancelled = false) {
    this.move(point)
    const tapped = !cancelled && this.candidate?.id === id && time - this.candidate.time < 600
    this.candidate = undefined
    this.active.delete(id)
    return tapped
  }

  cancel() {
    this.candidate = undefined
  }

  reset() {
    this.cancel()
    this.active.clear()
  }
}
