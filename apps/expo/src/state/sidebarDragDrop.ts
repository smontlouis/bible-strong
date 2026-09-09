import type { TabGroup } from './tabs'

export type SidebarDrag =
  | { kind: 'tab'; groupId: string; tabId: string }
  | { kind: 'group'; groupId: string }
export type SidebarDrop = { groupId: string; tabId?: string; edge: 'before' | 'after' | 'inside' }

export function applySidebarDrop(
  groups: TabGroup[],
  activeGroupId: string,
  drag: SidebarDrag,
  target: SidebarDrop,
  now = Date.now()
) {
  const source = groups.find(group => group.id === drag.groupId)
  const destination = groups.find(group => group.id === target.groupId)
  if (!source || !destination) return null
  if (drag.kind === 'group') {
    if (source.isDefault || destination.isDefault || source.id === destination.id) return null
    const next = groups.filter(group => group.id !== source.id)
    const index =
      next.findIndex(group => group.id === destination.id) + (target.edge === 'after' ? 1 : 0)
    next.splice(index, 0, source)
    return { groups: next, activeGroupId }
  }
  const moved = source.tabs.find(tab => tab.id === drag.tabId)
  if (!moved || target.tabId === moved.id) return null
  const destinationTabs = destination.tabs.filter(tab => tab.id !== moved.id)
  const targetIndex = target.tabId
    ? destinationTabs.findIndex(tab => tab.id === target.tabId)
    : destinationTabs.length
  if (targetIndex < 0) return null
  const insertionIndex = targetIndex + (target.tabId && target.edge === 'after' ? 1 : 0)
  destinationTabs.splice(insertionIndex, 0, moved)
  const movingActiveTab =
    source.id === activeGroupId && source.tabs[source.activeTabIndex]?.id === moved.id
  const next = groups.map(group => {
    if (group.id !== source.id && group.id !== destination.id) return group
    const tabs =
      group.id === destination.id ? destinationTabs : group.tabs.filter(tab => tab.id !== moved.id)
    const selectedId =
      group.id === destination.id && movingActiveTab
        ? moved.id
        : group.tabs[group.activeTabIndex]?.id
    const selectedIndex = tabs.findIndex(tab => tab.id === selectedId)
    return {
      ...group,
      tabs,
      activeTabIndex:
        selectedIndex >= 0
          ? selectedIndex
          : Math.max(0, Math.min(group.activeTabIndex, tabs.length - 1)),
      updatedAt: now,
    }
  })
  return { groups: next, activeGroupId: movingActiveTab ? destination.id : activeGroupId }
}
