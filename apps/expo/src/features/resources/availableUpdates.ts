import type {
  OfflineResourceRegistryEntry,
  OfflineResourceRegistrySnapshot,
} from './resourceAvailability'

/** Resources installed as part of another one: they never appear in the downloads list. */
const NOT_LISTED_SEPARATELY = new Set(['bible-pericope', 'bible-red-words', 'dictionary-directory'])

/**
 * An installed Offline copy needs an update when the catalog lists another archive, or when a
 * sidecar no longer matches the copy it depends on.
 */
export const resourceNeedsUpdate = (entry: OfflineResourceRegistryEntry): boolean => {
  if (entry.updateAvailable) return true
  const { kind } = entry.resource
  const { status } = entry.availability
  if (kind === 'strong-bible-index') return status === 'incompatible'
  if (kind === 'strong-lexicon-module')
    return status === 'incompatible' || status === 'core-missing'
  if (kind === 'interlinear-index') return status === 'base-incompatible'
  return false
}

/**
 * Listed resources that need an update, keyed by id. The value identifies the update itself, so
 * a later catalog revision of an update already seen counts as a new one.
 */
export const getAvailableUpdates = (
  snapshot: OfflineResourceRegistrySnapshot
): Map<string, string> => {
  const updates = new Map<string, string>()
  for (const entry of snapshot.resources.values()) {
    if (NOT_LISTED_SEPARATELY.has(entry.resource.kind) || !resourceNeedsUpdate(entry)) continue
    updates.set(entry.id, `${entry.catalogRevision ?? ''}:${entry.availability.status}`)
  }
  return updates
}

export type SeenResourceUpdates = Readonly<Record<string, string>>

export const hasUnseenUpdates = (
  updates: ReadonlyMap<string, string>,
  seen: SeenResourceUpdates
): boolean => [...updates].some(([id, update]) => seen[id] !== update)

/** Returns `seen` itself when every update was already seen, so the stored value stays stable. */
export const markUpdatesSeen = (
  updates: ReadonlyMap<string, string>,
  seen: SeenResourceUpdates
): SeenResourceUpdates =>
  hasUnseenUpdates(updates, seen) ? { ...seen, ...Object.fromEntries(updates) } : seen
