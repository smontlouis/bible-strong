import { useStore } from 'jotai/react'
import { cachedTabIdsAtom, getGroupTabsAtomsAtom, tabGroupsAtom, type TabGroup } from '~state/tabs'

export function useCloseWorkspaceTab() {
  const store = useStore()
  return (group: TabGroup, tabId: string) => {
    const groupAtoms = getGroupTabsAtomsAtom(group.id)
    const tabAtom = store.get(groupAtoms).find(item => store.get(item).id === tabId)
    if (!tabAtom || !store.get(tabAtom).isRemovable) return
    // Closing an earlier row must not change the selected content.
    const selectedId = group.tabs[group.activeTabIndex]?.id
    store.set(groupAtoms, { type: 'remove', atom: tabAtom })
    store.set(
      cachedTabIdsAtom,
      store.get(cachedTabIdsAtom).filter(id => id !== tabId)
    )
    const remainingGroup = store.get(tabGroupsAtom).find(item => item.id === group.id)
    const selectedIndex = remainingGroup?.tabs.findIndex(tab => tab.id === selectedId) ?? -1
    if (selectedIndex >= 0) {
      store.set(tabGroupsAtom, current =>
        current.map(item =>
          item.id === group.id ? { ...item, activeTabIndex: selectedIndex } : item
        )
      )
    }
  }
}
