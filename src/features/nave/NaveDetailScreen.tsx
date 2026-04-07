import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useLocalSearchParams } from 'expo-router'
import generateUUID from '~helpers/generateUUID'
import { NaveTab } from '../../state/tabs'
import NaveDetailTabScreen from './NaveDetailTabScreen'

const NaveDetailScreen = () => {
  const params = useLocalSearchParams<{ name_lower?: string; name?: string }>()

  // Parse params from URL strings
  const name_lower = params.name_lower || ''
  const name = params.name || ''

  const onTheFlyAtom = useMemo(
    () =>
      atom<NaveTab>({
        id: `nave-${generateUUID()}`,
        title: 'Nave',
        isRemovable: true,
        hasBackButton: true,
        type: 'nave',
        data: {
          name_lower,
          name,
        },
      } as NaveTab),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return <NaveDetailTabScreen naveAtom={onTheFlyAtom} />
}
export default NaveDetailScreen
