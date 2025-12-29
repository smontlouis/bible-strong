import React, { useCallback } from 'react'

import produce from 'immer'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { StackNavigationProp } from '@react-navigation/stack'
import { NaveTab } from '../../state/tabs'
import NaveListScreen from './NaveListScreen'
import NaveDetailTabScreen from './NaveDetailTabScreen'
import { MainStackProps } from '~navigation/type'
import { RouteProp } from '@react-navigation/native'

interface NaveTabScreenProps {
  navigation: StackNavigationProp<MainStackProps>
  route: RouteProp<MainStackProps>
  naveAtom: PrimitiveAtom<NaveTab>
}

const NaveTabScreen = ({ naveAtom, navigation }: NaveTabScreenProps) => {
  const [naveTab, setNaveTab] = useAtom(naveAtom)

  const {
    data: { name_lower },
    hasBackButton,
  } = naveTab

  // Determine if we're in list or detail view
  const hasDetail = !!name_lower

  const onNaveSelect = useCallback(
    (nameLower: string, name: string) => {
      setNaveTab(
        produce(draft => {
          draft.data.name_lower = nameLower
          draft.data.name = name
        })
      )
    },
    [setNaveTab]
  )

  if (!hasDetail) {
    return (
      <NaveListScreen
        hasBackButton={hasBackButton}
        navigation={navigation}
        naveAtom={naveAtom}
        onNaveSelect={onNaveSelect}
      />
    )
  }

  return (
    <NaveDetailTabScreen
      naveAtom={naveAtom}
      navigation={navigation}
    />
  )
}

export default NaveTabScreen
