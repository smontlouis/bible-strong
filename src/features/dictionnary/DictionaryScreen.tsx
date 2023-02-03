import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { NavigationStackScreenProps } from 'react-navigation-stack'
import { DictionariesTab } from '../../state/tabs'
import DictionaryTabScreen from './DictionaryTabScreen'

interface DictionaryScreenProps {}

const DictionaryScreen = ({
  navigation,
}: NavigationStackScreenProps<DictionaryScreenProps>) => {
  const { t } = useTranslation()
  const onTheFlyAtom = useMemo(
    () =>
      atom<DictionariesTab>({
        id: `dictionaries-${Date.now()}`,
        title: t('Dictionnaire'),
        isRemovable: true,
        hasBackButton: true,
        type: 'dictionaries',
        data: {},
      } as DictionariesTab),
    []
  )

  return (
    <DictionaryTabScreen
      dictionariesAtom={onTheFlyAtom}
      navigation={navigation}
      hasBackButton
    />
  )
}
export default DictionaryScreen
