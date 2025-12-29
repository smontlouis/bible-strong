import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { StackScreenProps } from '@react-navigation/stack'
import { DictionaryTab } from '../../state/tabs'
import DictionaryListScreen from './DictionaryListScreen'
import { MainStackProps } from '~navigation/type'

const DictionaryScreen = ({ navigation }: StackScreenProps<MainStackProps, 'Dictionnaire'>) => {
  const { t } = useTranslation()
  const onTheFlyAtom = useMemo(
    () =>
      atom<DictionaryTab>({
        id: `dictionary-${Date.now()}`,
        title: t('Dictionnaire'),
        isRemovable: true,
        hasBackButton: true,
        type: 'dictionary',
        data: {},
      }),
    []
  )

  return (
    <DictionaryListScreen dictionaryAtom={onTheFlyAtom} navigation={navigation} hasBackButton />
  )
}
export default DictionaryScreen
