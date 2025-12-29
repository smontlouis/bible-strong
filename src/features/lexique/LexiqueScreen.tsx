import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { StackScreenProps } from '@react-navigation/stack'
import { StrongTab } from '../../state/tabs'
import LexiqueListScreen from './LexiqueListScreen'
import { MainStackProps } from '~navigation/type'

const LexiqueScreen = ({ navigation }: StackScreenProps<MainStackProps, 'Lexique'>) => {
  const { t } = useTranslation()
  const onTheFlyAtom = useMemo(
    () =>
      atom<StrongTab>({
        id: `strong-${Date.now()}`,
        title: t('Lexique'),
        isRemovable: true,
        hasBackButton: true,
        type: 'strong',
        data: {},
      }),
    []
  )

  return <LexiqueListScreen strongAtom={onTheFlyAtom} navigation={navigation} hasBackButton />
}
export default LexiqueScreen
