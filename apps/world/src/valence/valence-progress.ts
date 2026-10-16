import { pioneerObjects, stations, type PioneerObjectId, type StationId } from './valence-story'

export const PROGRESS_KEY = 'bible-strong.valence-1876.progress.v1'
export type ValenceProgress = { visited: StationId[]; found: PioneerObjectId[]; introSeen: boolean }
export const EMPTY_PROGRESS: ValenceProgress = { visited: [], found: [], introSeen: false }

const stationIds = new Set<string>(stations.map(station => station.id))
const objectIds = new Set<string>(pioneerObjects.map(object => object.id))

export function parseProgress(value: unknown): ValenceProgress {
  if (!value || typeof value !== 'object') return { ...EMPTY_PROGRESS }
  const raw = value as Record<string, unknown>
  const list = (items: unknown, known: Set<string>) =>
    Array.isArray(items) ? [...new Set(items.filter((item): item is string => typeof item === 'string' && known.has(item)))] : []
  return {
    visited: list(raw.visited, stationIds) as StationId[],
    found: list(raw.found, objectIds) as PioneerObjectId[],
    introSeen: raw.introSeen === true,
  }
}

export function loadProgress(): ValenceProgress {
  try {
    return parseProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null'))
  } catch {
    return { ...EMPTY_PROGRESS }
  }
}

export function saveProgress(progress: ValenceProgress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    /* Private windows keep the visit in memory only. */
  }
}
