import { useAtomValue, useSetAtom } from 'jotai/react'
import { atom, getDefaultStore } from 'jotai/vanilla'

import generateUUID from '~helpers/generateUUID'
import {
  addTabToGroup,
  createTabGroup,
  deleteTabGroup,
  moveTabToGroup,
  renameTabGroup,
  reorderTabGroups,
  switchTabGroup,
  updateTabGroup,
} from './tabWorkspace'
import {
  tabGroupsAtom,
  activeGroupIdAtom,
  activeGroupAtom,
  cachedTabIdsAtom,
  TabGroup,
  TabItem,
  MAX_TAB_GROUPS,
  getDefaultBibleTab,
  groupsCountAtom,
  GROUP_COLORS,
  cleanupGroupTabsAtomCache,
} from './tabs'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const generateGroupId = () => `group-${generateUUID()}`

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

    const result = createTabGroup(groups, newGroup, MAX_TAB_GROUPS)
    if (!result.ok) return null

    set(tabGroupsAtom, result.groups)
    return result.value ?? null
  }
)

/**
 * Switch to a different tab group
 * Clears the cache to unload tabs from the previous group
 */
export const switchGroupAtom = atom(null, (get, set, groupId: string) => {
  const groups = get(tabGroupsAtom)
  const result = switchTabGroup(groups, groupId)

  if (!result.ok) {
    console.warn('[TabGroups] Group not found:', groupId)
    return false
  }

  // Clear cached tab IDs - this will unload tabs from the previous group
  set(cachedTabIdsAtom, result.cacheTabIds ?? [])

  // Switch to the new group
  set(activeGroupIdAtom, result.value ?? groupId)

  return true
})

/**
 * Rename a tab group
 */
export const renameGroupAtom = atom(
  null,
  (get, set, { groupId, newName }: { groupId: string; newName: string }) => {
    const groups = get(tabGroupsAtom)

    set(tabGroupsAtom, renameTabGroup(groups, groupId, newName).groups)
  }
)

/**
 * Update a tab group (name and/or color)
 */
export const updateGroupAtom = atom(
  null,
  (get, set, { groupId, name, color }: { groupId: string; name: string; color?: string }) => {
    const groups = get(tabGroupsAtom)

    set(tabGroupsAtom, updateTabGroup(groups, groupId, { name, color }).groups)
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

  const cachedIds = get(cachedTabIdsAtom)
  const result = deleteTabGroup(groups, groupId, cachedIds)
  if (!result.ok) return false

  set(cachedTabIdsAtom, result.cacheTabIds ?? cachedIds)

  // Clean up per-group atom cache
  cleanupGroupTabsAtomCache(groupId)

  // Remove the group
  set(tabGroupsAtom, result.groups)

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
    const result = addTabToGroup(groups, groupId, tab)

    if (!result.ok) {
      console.warn('[TabGroups] Group not found:', groupId)
      return false
    }

    set(tabGroupsAtom, result.groups)

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
    const cachedIds = get(cachedTabIdsAtom)
    const result = moveTabToGroup(groups, { tabId, fromGroupId, toGroupId, cacheTabIds: cachedIds })
    if (!result.ok) {
      console.warn('[TabGroups] Source, target group, or tab not found')
      return false
    }

    set(tabGroupsAtom, result.groups)
    if (cachedIds.includes(tabId)) {
      set(cachedTabIdsAtom, result.cacheTabIds ?? cachedIds)
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

    const result = reorderTabGroups(groups, fromIndex, toIndex)
    if (!result.ok) {
      return false
    }

    set(tabGroupsAtom, result.groups)
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

  const result = switchTabGroup(groups, groupId)
  if (!result.ok) {
    return false
  }

  store.set(cachedTabIdsAtom, result.cacheTabIds ?? [])
  store.set(activeGroupIdAtom, result.value ?? groupId)

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

  const result = createTabGroup(groups, newGroup, MAX_TAB_GROUPS)
  if (!result.ok) return null

  store.set(tabGroupsAtom, result.groups)
  return result.value ?? null
}
