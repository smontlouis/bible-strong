import { prepareTabGroupForSync } from '~helpers/tabGroupsFirestoreSync'
import type { TabGroup } from './tabs'
import { compareTabGroupOrder } from './tabWorkspace'

export type TabGroupChanges = Map<string, TabGroup | null>

/** Tracks local changes separately from received snapshots, including during a write. */
export function createTabGroupsSyncQueue(
  initialGroups: TabGroup[],
  send: (changes: TabGroupChanges) => Promise<void>
) {
  let observed = initialGroups
  let pending: TabGroupChanges = new Map()
  let inFlight: TabGroupChanges = new Map()
  let running = false
  let requested = false
  let disposed = false

  const recordLocal = (groups: TabGroup[]) => {
    const changed: TabGroupChanges = new Map()
    for (const group of groups) {
      const previous = observed.find(candidate => candidate.id === group.id)
      if (
        !previous ||
        JSON.stringify(prepareTabGroupForSync(group)) !==
          JSON.stringify(prepareTabGroupForSync(previous))
      ) {
        changed.set(group.id, group)
      }
    }
    for (const group of observed) {
      if (!groups.some(candidate => candidate.id === group.id)) changed.set(group.id, null)
    }
    for (const [id, group] of changed) pending.set(id, group)
    observed = groups
    return changed
  }

  const applyRemote = (groups: TabGroup[], retryingIds: Set<string>) => {
    const protectedChanges: TabGroupChanges = new Map()
    for (const id of retryingIds) {
      protectedChanges.set(id, observed.find(group => group.id === id) ?? null)
    }
    for (const [id, group] of inFlight) protectedChanges.set(id, group)
    for (const [id, group] of pending) protectedChanges.set(id, group)
    const merged = new Map(groups.map(group => [group.id, group]))
    for (const [id, group] of protectedChanges) {
      // Keep device-local navigation/selection changes made during the write too.
      if (group) merged.set(id, observed.find(candidate => candidate.id === id) ?? group)
      else merged.delete(id)
    }
    observed = [...merged.values()].sort(compareTabGroupOrder)
    return observed
  }

  const flush = async () => {
    if (disposed) return
    requested = true
    if (running) return
    running = true
    try {
      while (requested && pending.size > 0 && !disposed) {
        requested = false
        inFlight = pending
        pending = new Map()
        // send must either persist the changes remotely or hand them to the retry outbox.
        await send(inFlight)
        inFlight = new Map()
      }
    } finally {
      running = false
    }
  }

  const getOutstanding = (): TabGroupChanges => new Map([...inFlight, ...pending])

  const dispose = () => {
    disposed = true
    return getOutstanding()
  }

  return { recordLocal, applyRemote, flush, dispose, getOutstanding }
}
