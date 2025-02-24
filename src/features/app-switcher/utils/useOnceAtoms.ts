import { getDefaultStore } from 'jotai/vanilla'
import { useRef } from 'react'
import { activeTabIndexAtom, TabItem, tabsAtomsAtom } from '../../../state/tabs'

export const useOnceAtoms = () => {
  const initialTabIndex = useRef(getDefaultStore().get(activeTabIndexAtom))
  const initialAtomId = useRef(
    (
      getDefaultStore().get(tabsAtomsAtom)[
        initialTabIndex.current
      ] as unknown as TabItem
    )?.id
  )

  return {
    initialAtomId: initialAtomId.current,
    initialTabIndex: initialTabIndex.current,
  }
}
