import React from 'react'

import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'
import { DictionaryTab } from '../../state/tabs'
import DictionaryListScreen from './DictionaryListScreen'
import DictionaryDetailTabScreen from './DictionaryDetailTabScreen'

interface DictionaryTabScreenProps {
  dictionaryAtom: PrimitiveAtom<DictionaryTab>
}

const DictionaryTabScreen = ({ dictionaryAtom }: DictionaryTabScreenProps) => {
  const dictionaryTab = useAtomValue(dictionaryAtom)

  const {
    data: { word },
    hasBackButton,
  } = dictionaryTab

  // Determine if we're in list or detail view
  const hasDetail = !!word

  if (!hasDetail) {
    return <DictionaryListScreen hasBackButton={hasBackButton} dictionaryAtom={dictionaryAtom} />
  }

  return <DictionaryDetailTabScreen dictionaryAtom={dictionaryAtom} />
}

export default DictionaryTabScreen
