import { canStand, type NavigationDocument, type Point } from '../world'

const cache = new WeakMap<NavigationDocument, Point[]>()

/** Arrival points on the station forecourt, around the layout's spawn. Visitors may overlap. */
export function valenceSpawnCandidates(navigation: NavigationDocument, spawn: Point, radius = 46) {
  const cached = cache.get(navigation)
  if (cached) return cached
  const candidates: Point[] = []
  for (let y = spawn.y - radius; y <= spawn.y + radius; y += 6)
    for (let x = spawn.x - radius; x <= spawn.x + radius; x += 6) {
      const point = { x, y }
      if (Math.hypot(x - spawn.x, (y - spawn.y) * 1.6) <= radius && canStand(point, navigation))
        candidates.push(point)
    }
  if (!candidates.length && canStand(spawn, navigation)) candidates.push({ ...spawn })
  cache.set(navigation, candidates)
  return candidates
}

export function chooseValenceSpawn(navigation: NavigationDocument, spawn: Point, random = Math.random) {
  const candidates = valenceSpawnCandidates(navigation, spawn)
  if (!candidates.length) return null
  return { ...candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))] }
}

const squareCache = new WeakMap<NavigationDocument, Point[]>()

/** Stand bots stroll on the Place des Clercs and the market, in sight of the bookstall. */
export function valenceSquareCandidates(navigation: NavigationDocument) {
  const cached = squareCache.get(navigation)
  if (cached) return cached
  const candidates: Point[] = []
  for (let y = 300; y <= 540; y += 8)
    for (let x = 640; x <= 1040; x += 8) if (canStand({ x, y }, navigation)) candidates.push({ x, y })
  squareCache.set(navigation, candidates)
  return candidates
}
