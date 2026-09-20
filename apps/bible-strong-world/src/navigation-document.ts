import {
  WIDTH,
  HEIGHT,
  defaultNavigation,
  detailObstacles,
  DETAIL_OBSTACLE_REVISION,
  type NavigationDocument,
  type Polygon,
  type Zone,
} from './world'

export const NAVIGATION_FILE_URL = './navigation/archipelago.json'
export const NAVIGATION_SAVE_ENDPOINT = '/__study-world/navigation'
export const navigationFingerprint = (d: NavigationDocument) =>
  JSON.stringify([
    d.version,
    d.map,
    d.width,
    d.height,
    d.obstacleRevision ?? 1,
    d.zones.map(z => [z.id, z.name, z.kind, z.points]),
  ])

export function polygonIsValid(points: Polygon): boolean {
  if (points.length < 3 || points.length > 256) return false
  if (
    points.some(
      p =>
        p.length !== 2 ||
        !p.every(Number.isFinite) ||
        p[0] < 0 ||
        p[0] > WIDTH ||
        p[1] < 0 ||
        p[1] > HEIGHT
    )
  )
    return false
  let area = 0
  const cross = (a: readonly number[], b: readonly number[], c: readonly number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const on = (a: readonly number[], b: readonly number[], p: readonly number[]) =>
    Math.abs(cross(a, b, p)) < 1e-8 &&
    p[0] >= Math.min(a[0], b[0]) &&
    p[0] <= Math.max(a[0], b[0]) &&
    p[1] >= Math.min(a[1], b[1]) &&
    p[1] <= Math.max(a[1], b[1])
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length]
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01) return false
    area += a[0] * b[1] - b[0] * a[1]
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue
      const c = points[j],
        d = points[(j + 1) % points.length]
      if (
        (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) ||
        on(a, b, c) ||
        on(a, b, d) ||
        on(c, d, a) ||
        on(c, d, b)
      )
        return false
    }
  }
  return Math.abs(area) > 2
}

export function parseNavigation(value: unknown): NavigationDocument {
  if (!value || typeof value !== 'object') throw new Error('Invalid document')
  const d = value as Record<string, unknown>
  if (
    d.version !== 1 ||
    d.map !== 'archipelago' ||
    d.width !== WIDTH ||
    d.height !== HEIGHT ||
    !Array.isArray(d.zones) ||
    d.zones.length > 500 ||
    (d.obstacleRevision !== undefined &&
      (!Number.isInteger(d.obstacleRevision) ||
        (d.obstacleRevision as number) < 1 ||
        (d.obstacleRevision as number) > DETAIL_OBSTACLE_REVISION))
  )
    throw new Error('Incompatible map')
  const ids = new Set<string>()
  const zones: Zone[] = d.zones.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid zone')
    const z = raw as Record<string, unknown>
    if (
      typeof z.id !== 'string' ||
      z.id.length > 100 ||
      ids.has(z.id) ||
      typeof z.name !== 'string' ||
      z.name.length > 100 ||
      !z.name.trim() ||
      (z.kind !== 'allowed' && z.kind !== 'blocked') ||
      !Array.isArray(z.points)
    )
      throw new Error('Invalid zone')
    if (
      !z.points.every(
        p => Array.isArray(p) && p.length === 2 && p.every(n => typeof n === 'number')
      )
    )
      throw new Error('Invalid points')
    const points = z.points as [number, number][]
    if (!polygonIsValid(points)) throw new Error('Invalid polygon')
    ids.add(z.id)
    return { id: z.id, name: z.name.trim(), kind: z.kind, points: points.map(([x, y]) => [x, y]) }
  })
  if (!zones.some(z => z.kind === 'allowed')) throw new Error('No walkable zone')
  return {
    version: 1,
    map: 'archipelago',
    width: WIDTH,
    height: HEIGHT,
    obstacleRevision: (d.obstacleRevision as number | undefined) ?? 1,
    zones,
  }
}

// Add only the newly shipped obstacle set, once. Never reset custom greens, change
// existing shapes, restore deleted legacy obstacles, or resurrect edited/deleted
// detail obstacles after a revision-2 document has been saved.
export function upgradeNavigation(document: NavigationDocument): NavigationDocument {
  if ((document.obstacleRevision ?? 1) >= DETAIL_OBSTACLE_REVISION) return document
  const ids = new Set(document.zones.map(z => z.id))
  return {
    ...document,
    obstacleRevision: DETAIL_OBSTACLE_REVISION,
    zones: [...document.zones, ...structuredClone(detailObstacles.filter(z => !ids.has(z.id)))],
  }
}

export async function loadNavigation(): Promise<{ document: NavigationDocument; error: boolean }> {
  try {
    const response = await fetch(NAVIGATION_FILE_URL, { cache: 'no-store' })
    if (response.status === 404) {
      return { document: structuredClone(defaultNavigation), error: false }
    }
    if (!response.ok) throw new Error(`Navigation file returned ${response.status}`)
    const raw: unknown = await response.json()
    return {
      document: upgradeNavigation(parseNavigation(raw)),
      error: false,
    }
  } catch {
    return { document: structuredClone(defaultNavigation), error: true }
  }
}

export function serializeNavigation(document: NavigationDocument) {
  return JSON.stringify(parseNavigation(document), null, 2) + '\n'
}

export async function saveNavigation(document: NavigationDocument) {
  const response = await fetch(NAVIGATION_SAVE_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: serializeNavigation(document),
  })
  if (!response.ok) throw new Error(`Navigation save returned ${response.status}`)
}
