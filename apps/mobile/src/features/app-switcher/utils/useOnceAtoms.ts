import { getDefaultStore } from 'jotai/vanilla'
import { useRef } from 'react'
import { activeTabIndexAtom, tabsAtomsAtom } from '../../../state/tabs'

export const useOnceAtoms = () => {
  const store = getDefaultStore()
  const initialTabIndex = useRef(store.get(activeTabIndexAtom))

  // Use stable tab.id instead of atom.toString()
  const initialTabId = useRef(() => {
    const tabsAtoms = store.get(tabsAtomsAtom)
    if (tabsAtoms.length > 0 && initialTabIndex.current < tabsAtoms.length) {
      const tab = store.get(tabsAtoms[initialTabIndex.current])
      return tab?.id
    }
    return undefined
  })

  return {
    initialTabId: initialTabId.current(),
    initialTabIndex: initialTabIndex.current,
  }
}
