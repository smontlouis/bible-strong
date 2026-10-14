// Valence 1876 map geometry, in the 1672 × 941 source-image coordinate system of the map.
import type { Point } from '../world'
import type { PioneerObjectId, StationId } from './valence-story'
import anchors from './generated/anchors.json'

export const VALENCE_WIDTH = 1672
export const VALENCE_HEIGHT = 941
/** The visitor arrives by the Lyon train, like the Bourdeau family. */
export const VALENCE_SPAWN: Point = { x: anchors.spawn[0], y: anchors.spawn[1] }
export const AVATAR_SIZE = 44
export const STATION_RADIUS = 62
export const OBJECT_RADIUS = 26

const point = ([x, y]: number[]): Point => ({ x, y })
/** Ground points snapped to reachable ground by scripts/valence/build_navigation.py. */
export const stationAnchors = Object.fromEntries(
  Object.entries(anchors.stations).map(([id, value]) => [id, point(value)])
) as Record<StationId, Point>

/** Where the station's label floats, above the characters or the building. */
export const stationLabels: Record<StationId, Point> = {
  gare: { x: 1424, y: 182 },
  temple: { x: 855, y: 150 },
  maison: { x: 1478, y: 398 },
  cathedrale: { x: 1112, y: 735 },
  citadelle: { x: 485, y: 70 },
  champ: { x: 665, y: 700 },
  clercs: { x: 888, y: 392 },
  rhone: { x: 285, y: 702 },
}

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

/** The seven pioneer objects, each lying on reachable ground near its station. */
export const objectSpots = Object.fromEntries(
  Object.entries(anchors.objects).map(([id, value]) => [id, point(value)])
) as Record<PioneerObjectId, Point>

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
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
