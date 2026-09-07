import React from 'react'

import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'
import { NaveTab } from '../../state/tabs'
import NaveListScreen from './NaveListScreen'
import NaveDetailTabScreen from './NaveDetailTabScreen'

interface NaveTabScreenProps {
  naveAtom: PrimitiveAtom<NaveTab>
}

const NaveTabScreen = ({ naveAtom }: NaveTabScreenProps) => {
  const naveTab = useAtomValue(naveAtom)

  const {
    data: { name_lower },
    hasBackButton,
  } = naveTab

  // Determine if we're in list or detail view
  const hasDetail = !!name_lower

  if (!hasDetail) {
    return <NaveListScreen hasBackButton={hasBackButton} naveAtom={naveAtom} />
  }

  return <NaveDetailTabScreen naveAtom={naveAtom} />
}

export default NaveTabScreen
