import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import React, { memo } from 'react'
import { View } from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import useDynamicRefs from '~helpers/useDynamicRefs'
import { cachedTabIdsAtom, tabsAtomsAtom } from '../../state/tabs'
import TabScreen, { TabScreenProps } from './TabScreen/TabScreen'
import { MainStackProps } from '~navigation/type'
import { RouteProp } from '@react-navigation/native'

export interface ChachedTabScreensProps {
  navigation: StackNavigationProp<MainStackProps>
  route: RouteProp<MainStackProps>
}

const CachedTabScreens = ({ navigation, route }: ChachedTabScreensProps) => {
  const cachedTabIds = useAtomValue(cachedTabIdsAtom)
  const tabsAtoms = useAtomValue(tabsAtomsAtom)

  // Filter tabs using stable tab.id instead of atom.toString()
  const filteredTabsAtoms = tabsAtoms.filter(tabAtom => {
    const tab = getDefaultStore().get(tabAtom)
    return cachedTabIds.includes(tab.id)
  })

  return (
    <>
      {filteredTabsAtoms.map(tabAtom => {
        const tab = getDefaultStore().get(tabAtom)
        return (
          <TabScreenRefMemoize
            key={tab.id}
            tabAtom={tabAtom}
            navigation={navigation}
            route={route}
          />
        )
      })}
    </>
  )
}

const TabScreenRefMemoize = memo((props: TabScreenProps) => {
  const [, setRef] = useDynamicRefs<View>()
  const tab = getDefaultStore().get(props.tabAtom)
  const ref = setRef(tab.id)

  return <TabScreen {...props} ref={ref} />
})

export default memo(CachedTabScreens)
