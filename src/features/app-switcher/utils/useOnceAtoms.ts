import { useAtom } from 'jotai'
import { useRef } from 'react'
import { tabsAtomsAtom, activeTabIndexAtom } from '../../../state/tabs'

export const useOnceAtoms = () => {
  const [tabsAtoms] = useAtom(tabsAtomsAtom)
  const [tabIndex] = useAtom(activeTabIndexAtom)
  const initialAtomId = useRef(tabsAtoms[tabIndex]?.toString())
  const initialTabIndex = useRef(tabIndex)
  return {
    initialAtomId: initialAtomId.current,
    initialTabIndex: initialTabIndex.current,
  }
}
