import { useAtom, useAtomValue } from 'jotai/react'
import React, { memo, useMemo } from 'react'
import { View } from 'react-native'
import { StackNavigationProp } from '@react-navigation/stack'
import useDynamicRefs from '~helpers/useDynamicRefs'
import { cachedTabIdsAtom, tabsAtomsAtom } from '../../state/tabs'
import TabScreen, { TabScreenProps } from './TabScreen/TabScreen'
import useOnce from './utils/useOnce'
import { MainStackProps } from '~navigation/type'

export interface ChachedTabScreensProps {
  navigation: StackNavigationProp<MainStackProps>
}

const CachedTabScreens = ({ navigation }: ChachedTabScreensProps) => {
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
          />
        ))}
    </>
  )
}

const TabScreenRefMemoize = (props: TabScreenProps) => {
  const [, setRef] = useDynamicRefs<View>()
  const ref = useMemo(() => setRef(props.tabAtom.toString()), [])

  return <TabScreen {...props} ref={ref} />
}

export default memo(CachedTabScreens)
