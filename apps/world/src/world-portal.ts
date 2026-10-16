import type { Point, Zone } from './world'

/**
 * The stone arch on the central plaza, east of the Bible, where shrubs grew: the way to Valence
 * 1876 (docs/adr/0085). It mirrors the app's phone stand west of the Bible. Positions are in the
 * map's 1671 × 941 source coordinates.
 */
export const WORLD_PORTAL = {
  to: 'valence-1876',
  /** Bottom centre of the arch's round base. */
  x: 940,
  y: 528,
  width: 78,
  height: 101,
  /** Ground line of the pillars, for depth against the visitor. */
  baseY: 509,
  /** Centre of the base: the visitor must stand near it to travel. */
  center: { x: 940, y: 516 },
  radius: 46,
  /** The light inside the arch's opening. */
  opening: { x: 940, y: 476, width: 30, height: 44 },
  /** Where travellers from Valence step out, in front of the arch. */
  arrival: { x: 940, y: 544 },
} as const

/** Only the two pillars stand on the ground; visitors can step through the arch. */
export const WORLD_PORTAL_OBSTACLES: Zone[] = [
  {
    id: 'portal-pillar-west',
    name: 'Pilier ouest du portail',
    kind: 'blocked',
    points: [
      [911, 503],
      [928, 503],
      [928, 514],
      [911, 514],
    ],
  },
  {
    id: 'portal-pillar-east',
    name: 'Pilier est du portail',
    kind: 'blocked',
    points: [
      [955, 503],
      [971, 503],
      [971, 514],
      [955, 514],
    ],
  },
]

export function nearWorldPortal(point: Point) {
  return Math.hypot(point.x - WORLD_PORTAL.center.x, point.y - WORLD_PORTAL.center.y) <= WORLD_PORTAL.radius
}
