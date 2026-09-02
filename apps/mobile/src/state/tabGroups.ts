import { useAtomValue, useSetAtom } from 'jotai/react'
import { atom, getDefaultStore, type Getter, type Setter } from 'jotai/vanilla'

import generateUUID from '~helpers/generateUUID'
import { createTabWorkspaceController, renameTabGroup, updateTabGroup } from './tabWorkspace'
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

const tabWorkspace = (get: Getter, set: Setter) =>
  createTabWorkspaceController(
    {
      readGroups: () => get(tabGroupsAtom),
      writeGroups: groups => set(tabGroupsAtom, groups),
      readCachedTabIds: () => get(cachedTabIdsAtom),
      writeCachedTabIds: tabIds => set(cachedTabIdsAtom, tabIds),
      writeActiveGroupId: groupId => set(activeGroupIdAtom, groupId),
      cleanupGroup: cleanupGroupTabsAtomCache,
      createGroupId: generateGroupId,
      createDefaultTab: getDefaultBibleTab,
      now: Date.now,
      warn: (message, detail) => console.warn(message, detail ?? ''),
    },
    MAX_TAB_GROUPS
  )

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
    return tabWorkspace(get, set).createGroup({ name, color })
  }
)

/**
 * Switch to a different tab group
 * Clears the cache to unload tabs from the previous group
 */
export const switchGroupAtom = atom(null, (get, set, groupId: string) => {
  return tabWorkspace(get, set).switchGroup(groupId)
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
  return tabWorkspace(get, set).deleteGroup(groupId)
})

/**
 * Add a tab to a specific group (not necessarily the active one)
 */
export const addTabToGroupAtom = atom(
  null,
  (get, set, { groupId, tab }: { groupId: string; tab: TabItem }) => {
    return tabWorkspace(get, set).addTab(groupId, tab)
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
    return tabWorkspace(get, set).moveTab(tabId, fromGroupId, toGroupId)
  }
)

/**
 * Reorder groups
 */
export const reorderGroupsAtom = atom(
  null,
  (get, set, { fromIndex, toIndex }: { fromIndex: number; toIndex: number }) => {
    return tabWorkspace(get, set).reorderGroups(fromIndex, toIndex)
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
  return tabWorkspace(store.get, store.set).switchGroup(groupId)
}

/** Create a new group (outside React) */
export const createGroupFromOutsideReact = (
  name: string,
  color: string = GROUP_COLORS[0]
): string | null => {
  const store = getDefaultStore()
  return tabWorkspace(store.get, store.set).createGroup({ name, color })
}
