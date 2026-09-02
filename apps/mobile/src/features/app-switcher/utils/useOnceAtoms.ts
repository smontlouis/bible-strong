import { getDefaultStore } from 'jotai/vanilla'
import { useState } from 'react'
import { activeTabIndexAtom, tabsAtomsAtom } from '../../../state/tabs'

export const useOnceAtoms = () => {
  const [initialTab] = useState(() => {
    const store = getDefaultStore()
    const initialTabIndex = store.get(activeTabIndexAtom)
    const tabsAtoms = store.get(tabsAtomsAtom)
    const initialTabId =
      tabsAtoms.length > 0 && initialTabIndex < tabsAtoms.length
        ? store.get(tabsAtoms[initialTabIndex])?.id
        : undefined

    return { initialTabId, initialTabIndex }
  })

  return initialTab
}
