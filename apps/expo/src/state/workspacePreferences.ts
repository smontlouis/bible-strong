import { atom } from 'jotai/vanilla'
import { tabGroupsAtom } from './tabs'

// Derived from the synced group documents; drag-only folding remains transient.
export const collapsedWorkspaceGroupsAtom = atom(
  get =>
    get(tabGroupsAtom)
      .filter(group => !group.isDefault && group.isCollapsed)
      .map(group => group.id),
  (get, set, value: string[] | ((ids: string[]) => string[])) => {
    const previous = get(collapsedWorkspaceGroupsAtom)
    const ids = new Set(typeof value === 'function' ? value(previous) : value)
    const now = Date.now()
    const groups = get(tabGroupsAtom)
    let changed = false
    const next = groups.map(group => {
      const isCollapsed = !group.isDefault && ids.has(group.id)
      if (Boolean(group.isCollapsed) === isCollapsed) return group
      changed = true
      return { ...group, isCollapsed, updatedAt: now }
    })
    if (changed) set(tabGroupsAtom, next)
  }
)
