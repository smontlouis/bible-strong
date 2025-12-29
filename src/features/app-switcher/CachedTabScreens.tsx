import { useAtom, useAtomValue } from 'jotai/react'
import React, { memo } from 'react'
import { View } from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import useDynamicRefs from '~helpers/useDynamicRefs'
import { cachedTabIdsAtom, tabsAtomsAtom } from '../../state/tabs'
import TabScreen, { TabScreenProps } from './TabScreen/TabScreen'
import useOnce from './utils/useOnce'
import { MainStackProps } from '~navigation/type'
import { RouteProp } from '@react-navigation/native'

export interface ChachedTabScreensProps {
  navigation: StackNavigationProp<MainStackProps>
  route: RouteProp<MainStackProps>
}

const CachedTabScreens = ({ navigation, route }: ChachedTabScreensProps) => {
  const [cachedTabIds, setCachedTabIds] = useAtom(cachedTabIdsAtom)
  const tabsAtoms = useAtomValue(tabsAtomsAtom)

  // Little hack to have atomWithDefault but override default value
  useOnce(() => {
    setCachedTabIds(cachedTabIds)
  })

  return (
    <>
      {tabsAtoms
        .filter(tabAtom => cachedTabIds.includes(tabAtom.toString()))
        .map(tabAtom => (
          <TabScreenRefMemoize
            key={tabAtom.toString()}
            tabAtom={tabAtom}
            navigation={navigation}
            route={route}
          />
        ))}
    </>
  )
}

const TabScreenRefMemoize = memo((props: TabScreenProps) => {
  const [, setRef] = useDynamicRefs<View>()
  const ref = setRef(props.tabAtom.toString())

  return <TabScreen {...props} ref={ref} />
})

export default memo(CachedTabScreens)
