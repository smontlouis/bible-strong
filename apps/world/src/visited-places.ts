import { stations } from './world'

export const VISITED_PLACES_KEY = 'bible-strong.world.visited-places.v1'
const placeIds = new Set<string>(stations.map(station => station.id))

function validPlaces(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(value.filter((id): id is string => typeof id === 'string' && placeIds.has(id))),
  ]
}

export function loadVisitedPlaces(): string[] {
  try {
    return validPlaces(JSON.parse(localStorage.getItem(VISITED_PLACES_KEY) ?? 'null'))
  } catch {
    return []
  }
}

export function saveVisitedPlaces(visited: string[]): void {
  try {
    localStorage.setItem(VISITED_PLACES_KEY, JSON.stringify(validPlaces(visited)))
  } catch {
    // Keep exploration usable even when browser storage is unavailable.
  }
}
