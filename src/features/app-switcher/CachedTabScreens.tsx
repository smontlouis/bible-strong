import { useAtom } from 'jotai'
import React, { memo, useEffect } from 'react'
import { NavigationStackProp } from 'react-navigation-stack'
import { cachedTabIdsAtom, tabsAtomsAtom } from '../../state/tabs'
import { useAppSwitcherContext } from './AppSwitcherProvider'
import TabScreen from './TabScreen/TabScreen'

export interface ChachedTabScreensProps {
  activeAtomId?: string
  navigation: NavigationStackProp
}

const CachedTabScreens = ({
  activeAtomId,
  navigation,
}: ChachedTabScreensProps) => {
  const [cachedTabIds, setCachedTabIds] = useAtom(cachedTabIdsAtom)
  const [tabsAtoms] = useAtom(tabsAtomsAtom)
  const { cachedTabScreens } = useAppSwitcherContext()

  // Little hack to have atomWithDefault but override default value
  useEffect(() => {
    setCachedTabIds(cachedTabIds)
  }, [])

  console.log(cachedTabIds)
  console.log(cachedTabScreens.refs)

  return (
    <>
      {tabsAtoms
        .filter(tabAtom => cachedTabIds.includes(tabAtom.toString()))
        .map(tabAtom => (
          <TabScreen
            isActive={activeAtomId === tabAtom.toString()}
            key={tabAtom.toString()}
            tabAtom={tabAtom}
            navigation={navigation}
            ref={cachedTabScreens.refs[tabAtom.toString()]}
          />
        ))}
    </>
  )
}

export default memo(CachedTabScreens)
