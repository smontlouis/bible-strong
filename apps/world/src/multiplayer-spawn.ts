import { canStand, inPolygon, RADIUS, type NavigationDocument, type Point } from './world'

const candidatesByNavigation = new WeakMap<NavigationDocument, Point[]>()

// The outer paving circle in source-image coordinates, seen in perspective.
const ARRIVAL_CIRCLE = { x: 835, y: 458, rx: 143, ry: 81 }

export function centralSpawnCandidates(navigation: NavigationDocument): readonly Point[] {
  const cached = candidatesByNavigation.get(navigation)
  if (cached) return cached
  const island = navigation.zones.find(zone => zone.id === 'land-0' && zone.kind === 'allowed')
  const candidates: Point[] = []
  if (island) {
    const { x: cx, y: cy, rx, ry } = ARRIVAL_CIRCLE
    for (let y = cy - ry + RADIUS; y <= cy + ry - RADIUS; y += 8) {
      for (let x = cx - rx + RADIUS; x <= cx + rx - RADIUS; x += 8) {
        const point = { x, y }
        if (
          ((x - cx) / (rx - RADIUS)) ** 2 + ((y - cy) / (ry - RADIUS)) ** 2 <= 1 &&
          inPolygon(point, island.points) &&
          canStand(point, navigation)
        )
          candidates.push(point)
      }
    }
  }
  candidatesByNavigation.set(navigation, candidates)
  return candidates
}

/** Pick a walkable arrival position; visitors may overlap. */
export function chooseCentralSpawn(
  navigation: NavigationDocument,
  random = Math.random
): Point | null {
  const available = centralSpawnCandidates(navigation)
  if (!available.length) return null
  return {
    ...available[
      Math.min(available.length - 1, Math.floor(Math.max(0, random()) * available.length))
    ],
  }
}
