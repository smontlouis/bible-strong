import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { NavigationStackScreenProps } from 'react-navigation-stack'
import { NaveTab } from '../../state/tabs'
import NaveDetailTabScreen from './NaveDetailTabScreen'

interface NaveDetailScreenProps {
  name_lower: string
  name: string
}

const NaveDetailScreen = ({
  navigation,
}: NavigationStackScreenProps<NaveDetailScreenProps>) => {
  const name_lower = navigation.getParam('name_lower')
  const name = navigation.getParam('name')

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
