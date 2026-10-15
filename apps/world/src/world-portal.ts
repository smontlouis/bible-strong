import type { Point, Zone } from './world'

/**
 * The stone arch on the circle south of the comparison island: the way to Valence 1876
 * (docs/adr/0085). Positions are in the map's 1671 × 941 source coordinates.
 */
export const WORLD_PORTAL = {
  to: 'valence-1876',
  /** Bottom centre of the arch's round base, laid on the painted stone circle. */
  x: 833,
  y: 840,
  width: 78,
  height: 101,
  /** Ground line of the pillars, for depth against the visitor. */
  baseY: 821,
  /** Centre of the circle: the visitor must stand on it to travel. */
  center: { x: 833, y: 828 },
  radius: 42,
  /** The light inside the arch's opening. */
  opening: { x: 833, y: 788, width: 30, height: 44 },
  /** Where travellers from Valence step out, in front of the arch. */
  arrival: { x: 833, y: 850 },
} as const

/** Only the two pillars stand on the ground; visitors can step through the arch. */
export const WORLD_PORTAL_OBSTACLES: Zone[] = [
  {
    id: 'portal-pillar-west',
    name: 'Pilier ouest du portail',
    kind: 'blocked',
    points: [
      [804, 815],
      [821, 815],
      [821, 826],
      [804, 826],
    ],
  },
  {
    id: 'portal-pillar-east',
    name: 'Pilier est du portail',
    kind: 'blocked',
    points: [
      [848, 815],
      [864, 815],
      [864, 826],
      [848, 826],
    ],
  },
]

export function nearWorldPortal(point: Point) {
  return Math.hypot(point.x - WORLD_PORTAL.center.x, point.y - WORLD_PORTAL.center.y) <= WORLD_PORTAL.radius
}
