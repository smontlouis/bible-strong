import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import React, { memo } from 'react'
import { View } from 'react-native'
import useDynamicRefs from '~helpers/useDynamicRefs'
import { cachedTabIdsAtom, tabsAtomsAtom } from '../../state/tabs'
import TabScreen, { TabScreenProps } from './TabScreen/TabScreen'

const CachedTabScreens = () => {
  const cachedTabIds = useAtomValue(cachedTabIdsAtom)
  const tabsAtoms = useAtomValue(tabsAtomsAtom)

  // Filter tabs using stable tab.id instead of atom.toString()
  // Add null check to prevent crash during navigation transitions
  const filteredTabsAtoms = tabsAtoms.filter(tabAtom => {
    const tab = getDefaultStore().get(tabAtom)
    return tab && cachedTabIds.includes(tab.id)
  })

  // Debug log for cached tabs
  // console.log('[CachedTabScreens] Cached tabs:', cachedTabIds.length, cachedTabIds)

  return (
    <>
      {filteredTabsAtoms.map(tabAtom => {
        const tab = getDefaultStore().get(tabAtom)
        if (!tab) return null
        return <TabScreenRefMemoize key={tab.id} tabAtom={tabAtom} />
      })}
    </>
  )
}

const TabScreenRefMemoize = memo((props: TabScreenProps) => {
  const [, setRef] = useDynamicRefs<View>()
  const tab = getDefaultStore().get(props.tabAtom)
  if (!tab) return null
  const ref = setRef(tab.id)

  return <TabScreen {...props} ref={ref} />
})

export default memo(CachedTabScreens)
