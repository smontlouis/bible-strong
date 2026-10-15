// Valence 1876 map geometry, in the 1672 × 941 source-image coordinate system of the map.
// Positions come from public/valence-1876/layout.json, edited in the workshop and loaded at
// start; the records below are filled in place so every module shares the same objects.
import type { Point } from '../world'
import type { PioneerObjectId, StationId } from './valence-story'
import { VALENCE_HEIGHT, VALENCE_WIDTH, type ValenceLayout } from './valence-documents'

export { VALENCE_HEIGHT, VALENCE_WIDTH }
export const AVATAR_SIZE = 44
export const STATION_RADIUS = 62
export const OBJECT_RADIUS = 26

/** The visitor arrives by the Lyon train, like the Bourdeau family. */
export const VALENCE_SPAWN: Point = { x: 0, y: 0 }
/** Ground point in front of each station's characters; the dialog opens within reach. */
export const stationAnchors = {} as Record<StationId, Point>
/** Where the station's tag floats, above the characters or the building. */
export const stationLabels = {} as Record<StationId, Point>
/** The seven pioneer objects, each lying on reachable ground near its station. */
export const objectSpots = {} as Record<PioneerObjectId, Point>
/** One polyline per pair of consecutive stations, in the order of the dates. */
export const threadPaths: Point[][] = []
/** The train to the archipelago: the platform point travellers leave from and arrive at, and its tag. */
export const valencePortal = { ground: { x: 0, y: 0 }, label: { x: 0, y: 0 } }
export const PORTAL_RADIUS = 46

/** The dotted thread follows the dates, not the shortest tour. */
export const threadOrder: StationId[] = [
  'gare',
  'temple',
  'maison',
  'cathedrale',
  'citadelle',
  'champ',
  'clercs',
  'rhone',
]

const toPoint = ([x, y]: [number, number]): Point => ({ x, y })

export function applyLayout(layout: ValenceLayout) {
  Object.assign(VALENCE_SPAWN, toPoint(layout.spawn))
  for (const [id, value] of Object.entries(layout.stations)) stationAnchors[id as StationId] = toPoint(value)
  for (const [id, value] of Object.entries(layout.labels)) stationLabels[id as StationId] = toPoint(value)
  for (const [id, value] of Object.entries(layout.objects)) objectSpots[id as PioneerObjectId] = toPoint(value)
  Object.assign(valencePortal.ground, toPoint(layout.portal))
  Object.assign(valencePortal.label, toPoint(layout.portalLabel))
  threadPaths.splice(0, threadPaths.length, ...layout.thread.map(line => line.map(toPoint)))
}

export function currentLayout(): ValenceLayout {
  const pair = ({ x, y }: Point): [number, number] => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
  const map = <K extends string>(record: Record<K, Point>) =>
    Object.fromEntries(Object.entries<Point>(record).map(([id, value]) => [id, pair(value)])) as Record<K, [number, number]>
  return {
    version: 1,
    spawn: pair(VALENCE_SPAWN),
    stations: map(stationAnchors),
    labels: map(stationLabels),
    objects: map(objectSpots),
    portal: pair(valencePortal.ground),
    portalLabel: pair(valencePortal.label),
    thread: threadPaths.map(line => line.map(pair)),
  }
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function nearPortal(point: Point) {
  return distance(point, valencePortal.ground) <= PORTAL_RADIUS
}

export function nearestStation(point: Point): StationId | null {
  let best: StationId | null = null
  let bestDistance = STATION_RADIUS
  for (const id of Object.keys(stationAnchors) as StationId[]) {
    const d = distance(point, stationAnchors[id])
    if (d <= bestDistance) {
      best = id
      bestDistance = d
    }
  }
  return best
}

export function objectWithinReach(
  point: Point,
  found: ReadonlySet<PioneerObjectId>
): PioneerObjectId | null {
  for (const id of Object.keys(objectSpots) as PioneerObjectId[])
    if (!found.has(id) && distance(point, objectSpots[id]) <= OBJECT_RADIUS) return id
  return null
}
