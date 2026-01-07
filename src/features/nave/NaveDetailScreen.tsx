import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { NaveTab } from '../../state/tabs'
import NaveDetailTabScreen from './NaveDetailTabScreen'

const NaveDetailScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ name_lower?: string; name?: string }>()

  // Parse params from URL strings
  const name_lower = params.name_lower || ''
  const name = params.name || ''

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

  return <NaveDetailTabScreen naveAtom={onTheFlyAtom} navigation={router} />
}
export default NaveDetailScreen
