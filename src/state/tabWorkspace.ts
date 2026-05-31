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
