import { canStand, RADIUS, type NavigationDocument, type Point } from './world'

const STEP = 8
const BUCKET = 64
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const directions = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]

class Frontier {
  private items: { id: number; score: number }[] = []
  push(id: number, score: number) {
    const item = { id, score }
    let i = this.items.length
    this.items.push(item)
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.items[parent].score <= score) break
      this.items[i] = this.items[parent]
      i = parent
    }
    this.items[i] = item
  }
  pop() {
    if (!this.items.length) return undefined
    const first = this.items[0]
    const last = this.items.pop()!
    if (this.items.length) {
      let i = 0
      while (i * 2 + 1 < this.items.length) {
        let child = i * 2 + 1
        if (child + 1 < this.items.length && this.items[child + 1].score < this.items[child].score) child++
        if (this.items[child].score >= last.score) break
        this.items[i] = this.items[child]
        i = child
      }
      this.items[i] = last
    }
    return first.id
  }
}

/** Lazy A* grid using the same footprint clearance as manual movement. Recreate after zone edits. */
export class Pathfinder {
  private readonly columns: number
  private readonly rows: number
  private readonly cells: Uint8Array
  private readonly edges = new Map<number, boolean>()
  private readonly buckets = new Map<string, NavigationDocument>()
  private readonly bounds

  constructor(private readonly navigation: NavigationDocument) {
    this.columns = Math.ceil(navigation.width / STEP) + 1
    this.rows = Math.ceil(navigation.height / STEP) + 1
    this.cells = new Uint8Array(this.columns * this.rows)
    this.bounds = navigation.zones.map(zone => ({
      zone,
      left: Math.min(...zone.points.map(p => p[0])) - RADIUS,
      right: Math.max(...zone.points.map(p => p[0])) + RADIUS,
      top: Math.min(...zone.points.map(p => p[1])) - RADIUS,
      bottom: Math.max(...zone.points.map(p => p[1])) + RADIUS,
    }))
  }

  private canStand(point: Point) {
    if (point.x < 0 || point.y < 0 || point.x > this.navigation.width || point.y > this.navigation.height) return false
    const x = Math.floor(point.x / BUCKET) * BUCKET
    const y = Math.floor(point.y / BUCKET) * BUCKET
    const key = `${x},${y}`
    let local = this.buckets.get(key)
    if (!local) {
      local = {
        ...this.navigation,
        zones: this.bounds.filter(b => b.left <= x + BUCKET && b.right >= x && b.top <= y + BUCKET && b.bottom >= y).map(b => b.zone),
      }
      this.buckets.set(key, local)
    }
    return canStand(point, local)
  }

  /** Validate entire segments, including diagonals and the smoothed shortcuts. */
  clearSegment(a: Point, b: Point) {
    const steps = Math.max(1, Math.ceil(distance(a, b) / 2))
    for (let i = 0; i <= steps; i++) {
      if (!this.canStand({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps })) return false
    }
    return true
  }

  private point(id: number): Point {
    return { x: (id % this.columns) * STEP, y: Math.floor(id / this.columns) * STEP }
  }

  private usable(id: number) {
    if (!this.cells[id]) this.cells[id] = this.canStand(this.point(id)) ? 2 : 1
    return this.cells[id] === 2
  }

  private anchors(point: Point) {
    const result: number[] = []
    const column = Math.round(point.x / STEP), row = Math.round(point.y / STEP)
    for (let y = Math.max(0, row - 2); y <= Math.min(this.rows - 1, row + 2); y++) {
      for (let x = Math.max(0, column - 2); x <= Math.min(this.columns - 1, column + 2); x++) {
        const id = y * this.columns + x
        if (this.usable(id) && this.clearSegment(point, this.point(id))) result.push(id)
      }
    }
    return result
  }

  find(start: Point, goal: Point): Point[] | null {
    if (!this.canStand(start) || !this.canStand(goal)) return null
    if (this.clearSegment(start, goal)) return [goal]
    const goals = new Set(this.anchors(goal))
    if (!goals.size) return null
    const costs = new Float64Array(this.cells.length).fill(Infinity)
    const parents = new Int32Array(this.cells.length).fill(-1)
    const closed = new Uint8Array(this.cells.length)
    const frontier = new Frontier()
    for (const id of this.anchors(start)) {
      costs[id] = distance(start, this.point(id))
      frontier.push(id, costs[id] + distance(this.point(id), goal))
    }
    let current: number | undefined
    while ((current = frontier.pop()) !== undefined) {
      if (closed[current]) continue
      if (goals.has(current)) {
        const path = [goal]
        for (let id = current; id !== -1; id = parents[id]) path.push(this.point(id))
        path.push(start)
        path.reverse()
        const smooth: Point[] = []
        let from = 0
        while (from < path.length - 1) {
          let to = path.length - 1
          while (to > from + 1 && !this.clearSegment(path[from], path[to])) to--
          smooth.push(path[to])
          from = to
        }
        return smooth
      }
      closed[current] = 1
      const a = this.point(current)
      const column = current % this.columns, row = Math.floor(current / this.columns)
      for (const [dx, dy] of directions) {
        const x = column + dx, y = row + dy
        if (x < 0 || x >= this.columns || y < 0 || y >= this.rows) continue
        const next = y * this.columns + x
        if (closed[next] || !this.usable(next)) continue
        const b = this.point(next)
        const cost = costs[current] + distance(a, b)
        if (cost >= costs[next]) continue
        const key = Math.min(current, next) * this.cells.length + Math.max(current, next)
        let clear = this.edges.get(key)
        if (clear === undefined) {
          clear = this.clearSegment(a, b)
          this.edges.set(key, clear)
        }
        if (!clear) continue
        costs[next] = cost
        parents[next] = current
        frontier.push(next, cost + distance(b, goal))
      }
    }
    return null
  }
}
