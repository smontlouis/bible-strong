import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { StackScreenProps } from '@react-navigation/stack'
import { NaveTab } from '../../state/tabs'
import NaveDetailTabScreen from './NaveDetailTabScreen'
import { MainStackProps } from '~navigation/type'

const NaveDetailScreen = ({
  navigation,
  route
}: StackScreenProps<MainStackProps, 'NaveDetail'>) => {
  const name_lower = route.params.name_lower// navigation.getParam('name_lower')
  const name = route.params.name // navigation.getParam('name')

  const onTheFlyAtom = useMemo(
    () =>
      atom<NaveTab>({
        id: `nave-${Date.now()}`,
        title: 'Nave',
        isRemovable: true,
        hasBackButton: true,
        type: 'nave',
        data: {
          name_lower,
          name,
        },
      } as NaveTab),
    []
  )

  return <NaveDetailTabScreen naveAtom={onTheFlyAtom} navigation={navigation} />
}
export default NaveDetailScreen
