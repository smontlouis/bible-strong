import React, { useCallback } from 'react'

import produce from 'immer'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { NaveTab } from '../../state/tabs'
import NaveListScreen from './NaveListScreen'
import NaveDetailTabScreen from './NaveDetailTabScreen'

interface NaveTabScreenProps {
  naveAtom: PrimitiveAtom<NaveTab>
}

const NaveTabScreen = ({ naveAtom }: NaveTabScreenProps) => {
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
        naveAtom={naveAtom}
        onNaveSelect={onNaveSelect}
      />
    )
  }

  return (
    <NaveDetailTabScreen
      naveAtom={naveAtom}
    />
  )
}

export default NaveTabScreen
