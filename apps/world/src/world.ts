// PROTOTYPE: hand-annotated screen-space navigation on the supplied fixed illustration.
// Geometry uses the 1671 × 941 source image. It is not an isometric tile grid.
import detailFootprints from './generated/detail-footprints.json'
import { APP_DOWNLOAD_OBSTACLE } from './app-download'
export type Point = { x: number; y: number }
export type Polygon = readonly (readonly [number, number])[]
export const WIDTH = 1671
export const HEIGHT = 941
export const SPAWN: Point = { x: 836, y: 542 }
export const RADIUS = 7
export const MOVE_SPEED = 115

export const walkable: { name: string; points: Polygon }[] = [
  {
    name: 'Place',
    points: [
      [600, 416],
      [652, 381],
      [730, 358],
      [795, 337],
      [876, 338],
      [929, 363],
      [981, 378],
      [1069, 427],
      [1090, 492],
      [1061, 536],
      [963, 570],
      [881, 589],
      [769, 588],
      [665, 560],
      [601, 518],
      [578, 468],
    ],
  },
  {
    name: 'Dictionnaire',
    points: [
      [90, 245],
      [155, 210],
      [467, 210],
      [550, 233],
      [557, 283],
      [501, 319],
      [460, 348],
      [370, 373],
      [240, 377],
      [106, 335],
      [63, 289],
    ],
  },
  {
    name: 'Pont dictionnaire',
    points: [
      [482, 309],
      [508, 294],
      [667, 373],
      [646, 401],
    ],
  },
  {
    name: 'Lexique',
    points: [
      [638, 211],
      [697, 179],
      [995, 185],
      [1050, 235],
      [1017, 271],
      [941, 286],
      [874, 298],
      [791, 298],
      [681, 268],
    ],
  },
  {
    name: 'Pont lexique',
    points: [
      [801, 275],
      [866, 275],
      [871, 358],
      [795, 358],
    ],
  },
  {
    name: 'Références',
    points: [
      [1174, 237],
      [1260, 207],
      [1500, 198],
      [1605, 251],
      [1620, 310],
      [1550, 350],
      [1465, 371],
      [1270, 350],
      [1186, 298],
    ],
  },
  {
    name: 'Pont références',
    points: [
      [967, 373],
      [1193, 264],
      [1216, 301],
      [997, 420],
    ],
  },
  {
    name: 'Thèmes',
    points: [
      [123, 540],
      [239, 522],
      [438, 547],
      [541, 599],
      [566, 667],
      [543, 734],
      [464, 785],
      [360, 812],
      [243, 808],
      [126, 765],
      [66, 694],
      [76, 607],
    ],
  },
  {
    name: 'Pont thèmes',
    points: [
      [475, 537],
      [645, 488],
      [677, 519],
      [500, 598],
    ],
  },
  {
    name: 'Comparaisons',
    points: [
      [687, 666],
      [738, 638],
      [906, 638],
      [1004, 681],
      [1044, 744],
      [1042, 824],
      [987, 869],
      [901, 897],
      [753, 900],
      [668, 867],
      [629, 823],
      [638, 737],
    ],
  },
  {
    name: 'Pont comparaisons',
    points: [
      [800, 572],
      [866, 572],
      [873, 698],
      [785, 698],
    ],
  },
  {
    name: 'Commentaires',
    points: [
      [1196, 589],
      [1288, 577],
      [1490, 580],
      [1593, 629],
      [1616, 699],
      [1582, 768],
      [1510, 814],
      [1418, 844],
      [1281, 825],
      [1188, 778],
      [1156, 690],
    ],
  },
  {
    name: 'Pont commentaires',
    points: [
      [1006, 493],
      [1220, 565],
      [1194, 605],
      [993, 536],
    ],
  },
]

export const obstacles = [
  { name: 'Table centrale', x: 836, y: 460, rx: 47, ry: 20.5 },
  { name: 'Arbre central gauche', x: 705, y: 378, rx: 20, ry: 13 },
  { name: 'Arbre central droit', x: 906, y: 365, rx: 19, ry: 12 },
  { name: 'Arbre entrée commentaires', x: 1072, y: 422, rx: 20, ry: 12 },
  { name: 'Panneau gauche', x: 647, y: 469, rx: 13, ry: 10 },
  { name: 'Panneau droit', x: 1029, y: 469, rx: 13, ry: 10 },
  { name: 'Banc ouest', x: 706, y: 400, rx: 35, ry: 9 },
  { name: 'Tableau des petits mots', x: 951, y: 399, rx: 25, ry: 12 },
  { name: 'Bureau dictionnaire', x: 325, y: 291, rx: 84, ry: 33 },
  { name: 'Table lexique', x: 876, y: 247, rx: 62, ry: 23 },
  { name: 'Banc références', x: 1354, y: 286, rx: 49, ry: 15 },
  { name: 'Table thèmes', x: 299, y: 747, rx: 58, ry: 22 },
  { name: 'Médaillon cœur', x: 228, y: 612, rx: 45, ry: 16 },
  { name: 'Médaillon montagne', x: 340, y: 653, rx: 45, ry: 15 },
  { name: 'Médaillon flamme', x: 471, y: 686, rx: 42, ry: 17 },
  { name: 'Table comparaison gauche', x: 743, y: 789, rx: 51, ry: 28 },
  { name: 'Table comparaison droite', x: 935, y: 801, rx: 49, ry: 28 },
  { name: 'Table commentaires', x: 1388, y: 752, rx: 99, ry: 32 },
  { name: 'Pilier commentaires ouest', x: 1227, y: 692, rx: 15, ry: 12 },
  { name: 'Pilier commentaires est', x: 1519, y: 773, rx: 15, ry: 12 },
]

export function inPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

export type Zone = { id: string; name: string; kind: 'allowed' | 'blocked'; points: Polygon }
export type NavigationDocument = {
  version: 1
  map: 'archipelago'
  width: number
  height: number
  obstacleRevision?: number
  zones: Zone[]
}
export const DETAIL_OBSTACLE_REVISION = 2
export const detailObstacles: Zone[] = detailFootprints.map(zone => ({
  ...zone,
  kind: 'blocked',
  points: zone.points.map(([x, y]) => [x, y] as const),
}))
export const defaultNavigation: NavigationDocument = {
  version: 1,
  map: 'archipelago',
  width: WIDTH,
  height: HEIGHT,
  obstacleRevision: DETAIL_OBSTACLE_REVISION,
  zones: [
    ...walkable.map((zone, i): Zone => ({ ...zone, id: `land-${i}`, kind: 'allowed' })),
    ...obstacles.map(
      (o, i): Zone => ({
        id: `obstacle-${i}`,
        name: o.name,
        kind: 'blocked',
        points: Array.from(
          { length: 24 },
          (_, j) =>
            [
              o.x + o.rx * Math.cos((j * Math.PI) / 12),
              o.y + o.ry * Math.sin((j * Math.PI) / 12),
            ] as const
        ),
      })
    ),
    ...detailObstacles,
    APP_DOWNLOAD_OBSTACLE,
  ],
}

export function segmentDistance(point: Point, a: readonly number[], b: readonly number[]): number {
  const dx = b[0] - a[0],
    dy = b[1] - a[1]
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a[0]) * dx + (point.y - a[1]) * dy) / (dx * dx + dy * dy || 1))
  )
  return Math.hypot(point.x - a[0] - t * dx, point.y - a[1] - t * dy)
}

export function canStand(point: Point, navigation = defaultNavigation): boolean {
  const allowed = navigation.zones.filter(z => z.kind === 'allowed')
  if (!allowed.some(z => inPolygon(point, z.points))) return false
  // Check the union of all floors, including overlaps at bridge entrances.
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4
    const edge = { x: point.x + Math.cos(angle) * RADIUS, y: point.y + Math.sin(angle) * RADIUS }
    if (!allowed.some(({ points }) => inPolygon(edge, points))) return false
  }
  return !navigation.zones.some(
    z =>
      z.kind === 'blocked' &&
      (inPolygon(point, z.points) ||
        z.points.some(
          (a, i) => segmentDistance(point, a, z.points[(i + 1) % z.points.length]) <= RADIUS
        ))
  )
}

export function findSafePosition(preferred: Point, navigation: NavigationDocument): Point | null {
  if (canStand(preferred, navigation)) return preferred
  let best: Point | null = null,
    distance = Infinity
  for (let y = RADIUS; y < HEIGHT; y += 8)
    for (let x = RADIUS; x < WIDTH; x += 8) {
      const d = (preferred.x - x) ** 2 + (preferred.y - y) ** 2
      if (d < distance && canStand({ x, y }, navigation)) {
        best = { x, y }
        distance = d
      }
    }
  return best
}

export function move(
  position: Point,
  direction: Point,
  seconds: number,
  navigation = defaultNavigation
): Point {
  const magnitude = Math.hypot(direction.x, direction.y)
  if (magnitude < 0.12) return position
  const scale = Math.min(1, magnitude) / magnitude
  const distance = MOVE_SPEED * Math.min(seconds, 0.05)
  const dx = direction.x * scale * distance
  const dy = direction.y * scale * distance
  // Substeps prevent tunnelling; axis fallback lets the avatar slide along edges.
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2))
  let next = { ...position }
  for (let i = 0; i < count; i++) {
    const diagonal = { x: next.x + dx / count, y: next.y + dy / count }
    if (canStand(diagonal, navigation)) next = diagonal
    else {
      const horizontal = { x: next.x + dx / count, y: next.y }
      if (canStand(horizontal, navigation)) next = horizontal
      const vertical = { x: next.x, y: next.y + dy / count }
      if (canStand(vertical, navigation)) next = vertical
    }
  }
  return next
}

export const stations = [
  {
    id: 'dictionary',
    islandZoneId: 'land-1',
    name: 'Dictionnaire',
    en: 'Dictionary',
    x: 394,
    y: 336,
    color: '#f4b932',
  },
  {
    id: 'lexicon',
    islandZoneId: 'land-3',
    name: 'Lexique',
    en: 'Lexicon',
    x: 790,
    y: 259,
    color: '#497fe8',
  },
  {
    id: 'references',
    islandZoneId: 'land-5',
    name: 'Références',
    en: 'References',
    x: 1385,
    y: 328,
    color: '#ef8d7c',
  },
  {
    id: 'themes',
    islandZoneId: 'land-7',
    name: 'Thèmes',
    en: 'Themes',
    x: 394,
    y: 731,
    color: '#719cfa',
  },
  {
    id: 'comparison',
    islandZoneId: 'land-9',
    name: 'Comparaisons',
    en: 'Comparison',
    x: 838,
    y: 830,
    color: '#b18be3',
  },
  {
    id: 'commentaries',
    islandZoneId: 'land-11',
    name: 'Commentaires',
    en: 'Commentaries',
    x: 1385,
    y: 802,
    color: '#52b5b7',
  },
] as const
export type Station = (typeof stations)[number]

// Discovery follows the island's edited ground contour, excluding the connecting bridges.
export function stationAt(point: Point, navigation = defaultNavigation): Station | null {
  return (
    stations.find(station =>
      navigation.zones.some(
        zone =>
          zone.id === station.islandZoneId &&
          zone.kind === 'allowed' &&
          inPolygon(point, zone.points)
      )
    ) ?? null
  )
}

// Source-aligned SAM 3 cutouts are generated offline; see scripts/build-sam3-occluders.mjs.
export { default as occluders } from './generated/occlusion-manifest.json'
