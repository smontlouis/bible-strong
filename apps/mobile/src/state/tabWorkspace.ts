import type { TabGroup, TabItem } from './tabs'

export const clampTabIndex = (index: number, tabsLength: number): number => {
  if (tabsLength <= 0) return 0
  if (index < 0) return 0
  if (index >= tabsLength) return tabsLength - 1
  return index
}

export const updateTabGroupTabs = (
  groups: TabGroup[],
  groupId: string,
  tabs: TabItem[]
): TabGroup[] =>
  groups.map(group =>
    group.id === groupId
      ? {
          ...group,
          tabs,
          activeTabIndex: clampTabIndex(group.activeTabIndex, tabs.length),
          updatedAt: Date.now(),
        }
      : group
  )

export const updateTabGroupActiveIndex = (
  groups: TabGroup[],
  groupId: string,
  activeTabIndex: number
): TabGroup[] =>
  groups.map(group =>
    group.id === groupId
      ? {
          ...group,
          activeTabIndex: clampTabIndex(activeTabIndex, group.tabs.length),
        }
      : group
  )

export type TabWorkspaceResult<T = undefined> = {
  ok: boolean
  groups: TabGroup[]
  cacheTabIds?: string[]
  value?: T
}

export const createTabGroup = (
  groups: TabGroup[],
  newGroup: TabGroup,
  maxGroups: number
): TabWorkspaceResult<string> => {
  if (groups.length >= maxGroups) {
    return { ok: false, groups }
  }

  return {
    ok: true,
    groups: [...groups, newGroup],
    value: newGroup.id,
  }
}

export const switchTabGroup = (groups: TabGroup[], groupId: string): TabWorkspaceResult<string> => {
  if (!groups.find(group => group.id === groupId)) {
    return { ok: false, groups }
  }

  return {
    ok: true,
    groups,
    cacheTabIds: [],
    value: groupId,
  }
}

export const renameTabGroup = (
  groups: TabGroup[],
  groupId: string,
  name: string,
  updatedAt = Date.now()
): TabWorkspaceResult => ({
  ok: true,
  groups: groups.map(group => (group.id === groupId ? { ...group, name, updatedAt } : group)),
})

export const updateTabGroup = (
  groups: TabGroup[],
  groupId: string,
  { name, color, updatedAt = Date.now() }: { name: string; color?: string; updatedAt?: number }
): TabWorkspaceResult => ({
  ok: true,
  groups: groups.map(group =>
    group.id === groupId ? { ...group, name, ...(color && { color }), updatedAt } : group
  ),
})

export const deleteTabGroup = (
  groups: TabGroup[],
  groupId: string,
  cacheTabIds: string[]
): TabWorkspaceResult<string[]> => {
  const targetGroup = groups.find(group => group.id === groupId)
  if (!targetGroup || targetGroup.isDefault) {
    return { ok: false, groups, cacheTabIds }
  }

  const groupTabIds = targetGroup.tabs.map(tab => tab.id)

  return {
    ok: true,
    groups: groups.filter(group => group.id !== groupId),
    cacheTabIds: cacheTabIds.filter(id => !groupTabIds.includes(id)),
    value: groupTabIds,
  }
}

export const addTabToGroup = (
  groups: TabGroup[],
  groupId: string,
  tab: TabItem,
  updatedAt = Date.now()
): TabWorkspaceResult => {
  if (!groups.find(group => group.id === groupId)) {
    return { ok: false, groups }
  }

  return {
    ok: true,
    groups: groups.map(group =>
      group.id === groupId
        ? {
            ...group,
            tabs: [...group.tabs, tab],
            activeTabIndex: group.tabs.length,
            updatedAt,
          }
        : group
    ),
  }
}

export const moveTabToGroup = (
  groups: TabGroup[],
  {
    tabId,
    fromGroupId,
    toGroupId,
    cacheTabIds,
    updatedAt = Date.now(),
  }: {
    tabId: string
    fromGroupId: string
    toGroupId: string
    cacheTabIds: string[]
    updatedAt?: number
  }
): TabWorkspaceResult => {
  const fromGroup = groups.find(group => group.id === fromGroupId)
  const toGroup = groups.find(group => group.id === toGroupId)
  const tabToMove = fromGroup?.tabs.find(tab => tab.id === tabId)

  if (!fromGroup || !toGroup || !tabToMove) {
    return { ok: false, groups, cacheTabIds }
  }

  return {
    ok: true,
    cacheTabIds: cacheTabIds.filter(id => id !== tabId),
    groups: groups.map(group => {
      if (group.id === fromGroupId) {
        const tabs = group.tabs.filter(tab => tab.id !== tabId)
        return {
          ...group,
          tabs,
          activeTabIndex: clampTabIndex(group.activeTabIndex, tabs.length),
          updatedAt,
        }
      }

      if (group.id === toGroupId) {
        return {
          ...group,
          tabs: [...group.tabs, tabToMove],
          activeTabIndex: group.tabs.length,
          updatedAt,
        }
      }

      return group
    }),
  }
}

export const reorderTabGroups = (
  groups: TabGroup[],
  fromIndex: number,
  toIndex: number
): TabWorkspaceResult => {
  if (fromIndex < 0 || fromIndex >= groups.length || toIndex < 0 || toIndex >= groups.length) {
    return { ok: false, groups }
  }

  const nextGroups = [...groups]
  const [movedGroup] = nextGroups.splice(fromIndex, 1)
  nextGroups.splice(toIndex, 0, movedGroup)

  return {
    ok: true,
    groups: nextGroups,
  }
}

export interface TabWorkspaceAdapter {
  readGroups(): TabGroup[]
  writeGroups(groups: TabGroup[]): void
  readCachedTabIds(): string[]
  writeCachedTabIds(tabIds: string[]): void
  writeActiveGroupId(groupId: string): void
  cleanupGroup(groupId: string): void
  createGroupId(): string
  createDefaultTab(): TabItem
  now(): number
  warn(message: string, detail?: string): void
}

export const createTabWorkspaceController = (adapter: TabWorkspaceAdapter, maxGroups: number) => ({
  createGroup({ name, color }: { name: string; color: string }): string | null {
    const groups = adapter.readGroups()
    const now = adapter.now()
    const group: TabGroup = {
      id: adapter.createGroupId(),
      name,
      color,
      isDefault: false,
      tabs: [adapter.createDefaultTab()],
      activeTabIndex: 0,
      createdAt: now,
      updatedAt: now,
    }
    const result = createTabGroup(groups, group, maxGroups)
    if (!result.ok) {
      adapter.warn('[TabWorkspace] Maximum group limit reached')
      return null
    }
    adapter.writeGroups(result.groups)
    return result.value ?? null
  },

  switchGroup(groupId: string): boolean {
    const result = switchTabGroup(adapter.readGroups(), groupId)
    if (!result.ok) {
      adapter.warn('[TabWorkspace] Group not found', groupId)
      return false
    }
    adapter.writeCachedTabIds(result.cacheTabIds ?? [])
    adapter.writeActiveGroupId(result.value ?? groupId)
    return true
  },

  deleteGroup(groupId: string): boolean {
    const groups = adapter.readGroups()
    const result = deleteTabGroup(groups, groupId, adapter.readCachedTabIds())
    if (!result.ok) {
      adapter.warn('[TabWorkspace] Group cannot be deleted', groupId)
      return false
    }
    adapter.writeCachedTabIds(result.cacheTabIds ?? [])
    adapter.cleanupGroup(groupId)
    adapter.writeGroups(result.groups)
    return true
  },

  addTab(groupId: string, tab: TabItem): boolean {
    const result = addTabToGroup(adapter.readGroups(), groupId, tab, adapter.now())
    if (!result.ok) {
      adapter.warn('[TabWorkspace] Group not found', groupId)
      return false
    }
    adapter.writeGroups(result.groups)
    return true
  },

  moveTab(tabId: string, fromGroupId: string, toGroupId: string): boolean {
    const cachedTabIds = adapter.readCachedTabIds()
    const result = moveTabToGroup(adapter.readGroups(), {
      tabId,
      fromGroupId,
      toGroupId,
      cacheTabIds: cachedTabIds,
      updatedAt: adapter.now(),
    })
    if (!result.ok) {
      adapter.warn('[TabWorkspace] Source, target group, or tab not found')
      return false
    }
    adapter.writeGroups(result.groups)
    if (cachedTabIds.includes(tabId)) {
      adapter.writeCachedTabIds(result.cacheTabIds ?? cachedTabIds)
    }
    return true
  },

  reorderGroups(fromIndex: number, toIndex: number): boolean {
    const result = reorderTabGroups(adapter.readGroups(), fromIndex, toIndex)
    if (!result.ok) return false
    adapter.writeGroups(result.groups)
    return true
  },
})
