import React, { useCallback } from 'react'

import produce from 'immer'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtom } from 'jotai/react'
import { StackNavigationProp } from '@react-navigation/stack'
import { DictionaryTab } from '../../state/tabs'
import DictionaryListScreen from './DictionaryListScreen'
import DictionaryDetailTabScreen from './DictionaryDetailTabScreen'
import { MainStackProps } from '~navigation/type'
import { RouteProp } from '@react-navigation/native'

interface DictionaryTabScreenProps {
  navigation: StackNavigationProp<MainStackProps>
  route: RouteProp<MainStackProps>
  dictionaryAtom: PrimitiveAtom<DictionaryTab>
}

const DictionaryTabScreen = ({ dictionaryAtom, navigation }: DictionaryTabScreenProps) => {
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
        navigation={navigation}
        dictionaryAtom={dictionaryAtom}
        onWordSelect={onWordSelect}
      />
    )
  }

  return (
    <DictionaryDetailTabScreen
      dictionaryAtom={dictionaryAtom}
      navigation={navigation}
    />
  )
}

export default DictionaryTabScreen
