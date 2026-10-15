import type { NavigationDocument, Polygon, Zone } from '../world'

const cache = new WeakMap<NavigationDocument, NavigationDocument>()

function area(points: Polygon) {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i]
    const [bx, by] = points[(i + 1) % points.length]
    sum += ax * by - bx * ay
  }
  return sum / 2
}

/** Sutherland–Hodgman clipping of any simple polygon against an axis-aligned rectangle. */
export function clipPolygon(points: Polygon, left: number, top: number, right: number, bottom: number) {
  let output: [number, number][] = points.map(([x, y]) => [x, y])
  const edges: [(p: readonly number[]) => boolean, (a: readonly number[], b: readonly number[]) => [number, number]][] = [
    [p => p[0] >= left, (a, b) => [left, a[1] + ((b[1] - a[1]) * (left - a[0])) / (b[0] - a[0])]],
    [p => p[0] <= right, (a, b) => [right, a[1] + ((b[1] - a[1]) * (right - a[0])) / (b[0] - a[0])]],
    [p => p[1] >= top, (a, b) => [a[0] + ((b[0] - a[0]) * (top - a[1])) / (b[1] - a[1]), top]],
    [p => p[1] <= bottom, (a, b) => [a[0] + ((b[0] - a[0]) * (bottom - a[1])) / (b[1] - a[1]), bottom]],
  ]
  for (const [inside, cross] of edges) {
    const input = output
    output = []
    for (let i = 0; i < input.length; i++) {
      const current = input[i]
      const previous = input[(i + input.length - 1) % input.length]
      if (inside(current)) {
        if (!inside(previous)) output.push(cross(previous, current))
        output.push(current)
      } else if (inside(previous)) output.push(cross(previous, current))
    }
    if (!output.length) break
  }
  return output.filter(
    (point, index) =>
      index === 0 ||
      Math.hypot(point[0] - output[index - 1][0], point[1] - output[index - 1][1]) > 0.01
  )
}

/**
 * Walkable zones are edited as a few large polygons; movement and pathfinding test small
 * pieces. Each allowed polygon is clipped into overlapping square tiles so every pathfinder
 * bucket only sees a handful of short polygons. Obstacles stay whole: their edges keep the
 * avatar's clearance, and a cut edge would invent an obstacle along the seam.
 */
export function tileNavigation(document: NavigationDocument, size = 64, overlap = 4) {
  const cached = cache.get(document)
  if (cached) return cached
  const zones: Zone[] = []
  for (const zone of document.zones) {
    if (zone.kind === 'blocked') {
      zones.push(zone)
      continue
    }
    const xs = zone.points.map(p => p[0])
    const ys = zone.points.map(p => p[1])
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys)
    if (maxX - minX <= size && maxY - minY <= size && zone.points.length <= 24) {
      zones.push(zone)
      continue
    }
    for (let ty = Math.floor(minY / size) * size; ty < maxY; ty += size)
      for (let tx = Math.floor(minX / size) * size; tx < maxX; tx += size) {
        const piece = clipPolygon(zone.points, tx - overlap, ty - overlap, tx + size + overlap, ty + size + overlap)
        if (piece.length < 3 || Math.abs(area(piece)) < 1) continue
        zones.push({ id: `${zone.id}@${tx / size}:${ty / size}`, name: zone.name, kind: 'allowed', points: piece })
      }
  }
  const tiled = { ...document, zones }
  cache.set(document, tiled)
  return tiled
}
