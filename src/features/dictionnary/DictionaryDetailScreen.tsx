import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { StackScreenProps } from '@react-navigation/stack'
import { DictionaryTab } from '../../state/tabs'
import DictionaryDetailTabScreen from './DictionaryDetailTabScreen'
import { MainStackProps } from '~navigation/type'

const DictionaryDetailScreen = ({
  navigation,
  route
}: StackScreenProps<MainStackProps, 'DictionnaryDetail'>) => {
  const word = route.params.word // navigation.getParam('word')

  const onTheFlyAtom = useMemo(
    () =>
      atom<DictionaryTab>({
        id: `dictionary-${Date.now()}`,
        title: 'Dictionary',
        isRemovable: true,
        hasBackButton: true,
        type: 'dictionary',
        data: {
          word,
        },
      } as DictionaryTab),
    []
  )

  return (
    <DictionaryDetailTabScreen
      dictionaryAtom={onTheFlyAtom}
      navigation={navigation}
    />
  )
}
export default DictionaryDetailScreen
