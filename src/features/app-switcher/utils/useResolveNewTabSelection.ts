import { useRouter } from 'expo-router'
import { useAtomValue, useStore } from 'jotai/react'
import { TabItem, tabsAtomsAtom } from '~state/tabs'
import { useTabAnimations } from './useTabAnimations'

export const useResolveNewTabSelection = (tabId?: string) => {
  const router = useRouter()
  const store = useStore()
  const tabsAtoms = useAtomValue(tabsAtomsAtom)
  const { slideToIndex } = useTabAnimations()

  return (selectedTab: TabItem) => {
    if (!tabId) return false

    const tabIndex = tabsAtoms.findIndex(tabAtom => store.get(tabAtom).id === tabId)
    const tabAtom = tabsAtoms[tabIndex]

    if (!tabAtom) return false

    store.set(tabAtom, {
      ...selectedTab,
      id: tabId,
      base64Preview: '',
    })

    router.dismissTo('/')
    slideToIndex(tabIndex)

    return true
  }
}
