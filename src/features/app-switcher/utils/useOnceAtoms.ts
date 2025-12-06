import { getDefaultStore } from 'jotai/vanilla'
import { useRef } from 'react'
import { activeTabIndexAtom, tabsAtomsAtom } from '../../../state/tabs'

/**
 * Returns initial tab data for Reanimated SharedValues initialization.
 *
 * NOTE: This hook assumes that `hydrateTabsAtom()` has already been called
 * in App.tsx before InitApp renders. This ensures the Jotai store has the
 * correct data from MMKV before this hook runs.
 *
 * The atom.toString() value is required because TabScreen.tsx compares
 * activeTabScreen.atomId with tabAtom.toString() to determine visibility.
 */
export const useOnceAtoms = () => {
  const store = getDefaultStore()

  // Safe to use getDefaultStore() now because hydrateTabsAtom() was called first
  const initialTabIndex = useRef(store.get(activeTabIndexAtom))
  const initialAtomId = useRef(() => {
    const tabsAtoms = store.get(tabsAtomsAtom)
    const index = initialTabIndex.current
    if (index >= 0 && index < tabsAtoms.length) {
      return tabsAtoms[index].toString()
    }
    return tabsAtoms[0]?.toString() ?? null
  })

  return {
    initialAtomId: initialAtomId.current(),
    initialTabIndex: initialTabIndex.current,
  }
}
