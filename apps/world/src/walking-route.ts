import { move, MOVE_SPEED, type NavigationDocument, type Point } from './world'

/** Follows waypoints through the normal collision solver, with no overshoot at arrival. */
export class WalkingRoute {
  points: Point[] = []

  cancel() {
    this.points = []
  }

  advance(position: Point, seconds: number, navigation: NavigationDocument): Point {
    let remaining = Math.min(seconds, 0.05)
    let next = position
    while (this.points.length && remaining > 0) {
      const target = this.points[0]
      const distance = Math.hypot(target.x - next.x, target.y - next.y)
      if (distance < 0.01) {
        this.points.shift()
        continue
      }
      const duration = Math.min(remaining, distance / MOVE_SPEED)
      const previous = next
      next = move(next, { x: (target.x - next.x) / distance, y: (target.y - next.y) / distance }, duration, navigation)
      remaining -= duration
      if (Math.hypot(next.x - previous.x, next.y - previous.y) < 0.001) {
        this.cancel()
        break
      }
      if (Math.hypot(next.x - target.x, next.y - target.y) < 0.01) this.points.shift()
    }
    return next
  }
}
