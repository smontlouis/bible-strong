import React, { useCallback } from 'react'

import produce from 'immer'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { DictionaryTab } from '../../state/tabs'
import DictionaryListScreen from './DictionaryListScreen'
import DictionaryDetailTabScreen from './DictionaryDetailTabScreen'

interface DictionaryTabScreenProps {
  dictionaryAtom: PrimitiveAtom<DictionaryTab>
}

const DictionaryTabScreen = ({ dictionaryAtom }: DictionaryTabScreenProps) => {
  const [dictionaryTab, setDictionaryTab] = useAtom(dictionaryAtom)

  const {
    data: { word },
    hasBackButton,
  } = dictionaryTab

  // Determine if we're in list or detail view
  const hasDetail = !!word

  const onWordSelect = useCallback(
    (selectedWord: string) => {
      setDictionaryTab(
        produce(draft => {
          draft.data.word = selectedWord
        })
      )
    },
    [setDictionaryTab]
  )

  if (!hasDetail) {
    return (
      <DictionaryListScreen
        hasBackButton={hasBackButton}
        dictionaryAtom={dictionaryAtom}
        onWordSelect={onWordSelect}
      />
    )
  }

  return <DictionaryDetailTabScreen dictionaryAtom={dictionaryAtom} />
}

export default DictionaryTabScreen
