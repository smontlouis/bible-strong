import { useAtomValue, useSetAtom } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import { getDefaultStore } from 'jotai/vanilla'

import {
  tabGroupsAtom,
  activeGroupIdAtom,
  activeGroupAtom,
  cachedTabIdsAtom,
  TabGroup,
  TabItem,
  MAX_TAB_GROUPS,
  DEFAULT_GROUP_ID,
  getDefaultBibleTab,
  groupsCountAtom,
  GROUP_COLORS,
  cleanupGroupTabsAtomCache,
} from './tabs'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const generateGroupId = () => `group-${Date.now()}`

// ============================================================================
// ACTION ATOMS
// ============================================================================

/**
 * Create a new tab group
 * Returns the new group ID or null if max groups reached
 */
export const createGroupAtom = atom(
  null,
  (get, set, { name, color }: { name: string; color: string }) => {
    const groups = get(tabGroupsAtom)

    if (groups.length >= MAX_TAB_GROUPS) {
      console.warn('[TabGroups] Maximum group limit reached')
      return null
    }

    const now = Date.now()
    const newGroup: TabGroup = {
      id: generateGroupId(),
      name,
      color,
      isDefault: false,
      tabs: [getDefaultBibleTab()],
      activeTabIndex: 0,
      createdAt: now,
      updatedAt: now,
    }

    set(tabGroupsAtom, [...groups, newGroup])
    return newGroup.id
  }
)

/**
 * Switch to a different tab group
 * Clears the cache to unload tabs from the previous group
 */
export const switchGroupAtom = atom(null, (get, set, groupId: string) => {
  const groups = get(tabGroupsAtom)
  const targetGroup = groups.find(g => g.id === groupId)

  if (!targetGroup) {
    console.warn('[TabGroups] Group not found:', groupId)
    return false
  }

  // Clear cached tab IDs - this will unload tabs from the previous group
  set(cachedTabIdsAtom, [])

  // Switch to the new group
  set(activeGroupIdAtom, groupId)

  return true
})

/**
 * Rename a tab group
 */
export const renameGroupAtom = atom(
  null,
  (get, set, { groupId, newName }: { groupId: string; newName: string }) => {
    const groups = get(tabGroupsAtom)

    set(
      tabGroupsAtom,
      groups.map(g => (g.id === groupId ? { ...g, name: newName } : g))
    )
  }
)

/**
 * Update a tab group (name and/or color)
 */
export const updateGroupAtom = atom(
  null,
  (get, set, { groupId, name, color }: { groupId: string; name: string; color?: string }) => {
    const groups = get(tabGroupsAtom)

    set(
      tabGroupsAtom,
      groups.map(g =>
        g.id === groupId ? { ...g, name, ...(color && { color }) } : g
      )
    )
  }
)

/**
 * Delete a tab group
 * Cannot delete the default group
 * If deleting the active group, switches to the default group
 */
export const deleteGroupAtom = atom(null, (get, set, groupId: string) => {
  const groups = get(tabGroupsAtom)
  const targetGroup = groups.find(g => g.id === groupId)

  if (!targetGroup) {
    console.warn('[TabGroups] Group not found:', groupId)
    return false
  }

  if (targetGroup.isDefault) {
    console.warn('[TabGroups] Cannot delete the default group')
    return false
  }

  // Remove tab IDs from global cache that belong to this group
  const cachedIds = get(cachedTabIdsAtom)
  const groupTabIds = targetGroup.tabs.map(t => t.id)
  set(
    cachedTabIdsAtom,
    cachedIds.filter(id => !groupTabIds.includes(id))
  )

  // Clean up per-group atom cache
  cleanupGroupTabsAtomCache(groupId)

  // Remove the group
  set(
    tabGroupsAtom,
    groups.filter(g => g.id !== groupId)
  )

  // Note: Navigation après suppression est gérée par l'appelant (GroupActionsPopover)
  // via groupPager.navigateToPage() qui set aussi activeGroupIdAtom

  return true
})

/**
 * Add a tab to a specific group (not necessarily the active one)
 */
export const addTabToGroupAtom = atom(
  null,
  (get, set, { groupId, tab }: { groupId: string; tab: TabItem }) => {
    const groups = get(tabGroupsAtom)
    const targetGroup = groups.find(g => g.id === groupId)

    if (!targetGroup) {
      console.warn('[TabGroups] Group not found:', groupId)
      return false
    }

    set(
      tabGroupsAtom,
      groups.map(g =>
        g.id === groupId
          ? {
              ...g,
              tabs: [...g.tabs, tab],
              activeTabIndex: g.tabs.length, // Activate the new tab
            }
          : g
      )
    )

    return true
  }
)

/**
 * Move a tab from one group to another
 */
export const moveTabToGroupAtom = atom(
  null,
  (
    get,
    set,
    { tabId, fromGroupId, toGroupId }: { tabId: string; fromGroupId: string; toGroupId: string }
  ) => {
    const groups = get(tabGroupsAtom)
    const fromGroup = groups.find(g => g.id === fromGroupId)
    const toGroup = groups.find(g => g.id === toGroupId)

    if (!fromGroup || !toGroup) {
      console.warn('[TabGroups] Source or target group not found')
      return false
    }

    const tabToMove = fromGroup.tabs.find(t => t.id === tabId)
    if (!tabToMove) {
      console.warn('[TabGroups] Tab not found in source group')
      return false
    }

    // Remove from source, add to target
    set(
      tabGroupsAtom,
      groups.map(g => {
        if (g.id === fromGroupId) {
          const newTabs = g.tabs.filter(t => t.id !== tabId)
          return {
            ...g,
            tabs: newTabs,
            activeTabIndex: Math.min(g.activeTabIndex, newTabs.length - 1),
          }
        }
        if (g.id === toGroupId) {
          return {
            ...g,
            tabs: [...g.tabs, tabToMove],
            activeTabIndex: g.tabs.length, // Activate the moved tab
          }
        }
        return g
      })
    )

    // Update cache if needed
    const cachedIds = get(cachedTabIdsAtom)
    if (cachedIds.includes(tabId)) {
      // Remove from cache since it's now in a different group
      set(
        cachedTabIdsAtom,
        cachedIds.filter(id => id !== tabId)
      )
    }

    return true
  }
)

/**
 * Reorder groups
 */
export const reorderGroupsAtom = atom(
  null,
  (get, set, { fromIndex, toIndex }: { fromIndex: number; toIndex: number }) => {
    const groups = get(tabGroupsAtom)

    if (fromIndex < 0 || fromIndex >= groups.length || toIndex < 0 || toIndex >= groups.length) {
      return false
    }

    const newGroups = [...groups]
    const [movedGroup] = newGroups.splice(fromIndex, 1)
    newGroups.splice(toIndex, 0, movedGroup)

    set(tabGroupsAtom, newGroups)
    return true
  }
)

// ============================================================================
// REACT HOOKS
// ============================================================================

/** Get all tab groups */
export const useTabGroups = () => useAtomValue(tabGroupsAtom)

/** Get the currently active group */
export const useActiveGroup = () => useAtomValue(activeGroupAtom)

/** Get the ID of the currently active group */
export const useActiveGroupId = () => useAtomValue(activeGroupIdAtom)

/** Get the number of groups */
export const useGroupsCount = () => useAtomValue(groupsCountAtom)

/** Create a new group */
export const useCreateGroup = () => useSetAtom(createGroupAtom)

/** Switch to a different group */
export const useSwitchGroup = () => useSetAtom(switchGroupAtom)

/** Rename a group */
export const useRenameGroup = () => useSetAtom(renameGroupAtom)

/** Update a group (name and/or color) */
export const useUpdateGroup = () => useSetAtom(updateGroupAtom)

/** Delete a group */
export const useDeleteGroup = () => useSetAtom(deleteGroupAtom)

/** Add a tab to a specific group */
export const useAddTabToGroup = () => useSetAtom(addTabToGroupAtom)

/** Move a tab between groups */
export const useMoveTabToGroup = () => useSetAtom(moveTabToGroupAtom)

/** Reorder groups */
export const useReorderGroups = () => useSetAtom(reorderGroupsAtom)

/**
 * Convenience hook that returns all group management actions
 */
export const useTabGroupActions = () => {
  const createGroup = useSetAtom(createGroupAtom)
  const switchGroup = useSetAtom(switchGroupAtom)
  const renameGroup = useSetAtom(renameGroupAtom)
  const updateGroup = useSetAtom(updateGroupAtom)
  const deleteGroup = useSetAtom(deleteGroupAtom)
  const addTabToGroup = useSetAtom(addTabToGroupAtom)
  const moveTabToGroup = useSetAtom(moveTabToGroupAtom)
  const reorderGroups = useSetAtom(reorderGroupsAtom)

  return {
    createGroup,
    switchGroup,
    renameGroup,
    updateGroup,
    deleteGroup,
    addTabToGroup,
    moveTabToGroup,
    reorderGroups,
  }
}

// ============================================================================
// NON-REACT ACCESS (for use outside React components)
// ============================================================================

/** Get the current active group ID (outside React) */
export const getActiveGroupId = (): string => {
  return getDefaultStore().get(activeGroupIdAtom)
}

/** Get all tab groups (outside React) */
export const getTabGroups = (): TabGroup[] => {
  return getDefaultStore().get(tabGroupsAtom)
}

/** Get the current active group (outside React) */
export const getActiveGroup = (): TabGroup => {
  return getDefaultStore().get(activeGroupAtom)
}

/** Switch to a different group (outside React) */
export const switchGroupFromOutsideReact = (groupId: string): boolean => {
  const store = getDefaultStore()
  const groups = store.get(tabGroupsAtom)

  if (!groups.find(g => g.id === groupId)) {
    return false
  }

  // Clear cache
  store.set(cachedTabIdsAtom, [])
  // Switch group
  store.set(activeGroupIdAtom, groupId)

  return true
}

/** Create a new group (outside React) */
export const createGroupFromOutsideReact = (
  name: string,
  color: string = GROUP_COLORS[0]
): string | null => {
  const store = getDefaultStore()
  const groups = store.get(tabGroupsAtom)

  if (groups.length >= MAX_TAB_GROUPS) {
    return null
  }

  const now = Date.now()
  const newGroup: TabGroup = {
    id: generateGroupId(),
    name,
    color,
    isDefault: false,
    tabs: [getDefaultBibleTab()],
    activeTabIndex: 0,
    createdAt: now,
    updatedAt: now,
  }

  store.set(tabGroupsAtom, [...groups, newGroup])
  return newGroup.id
}
