import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { StackScreenProps } from '@react-navigation/stack'
import { NaveTab } from '../../state/tabs'
import NaveListScreen from './NaveListScreen'
import { MainStackProps } from '~navigation/type'

const NaveScreen = ({ navigation }: StackScreenProps<MainStackProps, 'Nave'>) => {
  const { t } = useTranslation()
  const onTheFlyAtom = useMemo(
    () =>
      atom<NaveTab>({
        id: `nave-${Date.now()}`,
        title: t('Thèmes Nave'),
        isRemovable: true,
        hasBackButton: true,
        type: 'nave',
        data: {},
      }),
    []
  )

  return <NaveListScreen naveAtom={onTheFlyAtom} navigation={navigation} hasBackButton />
}
export default NaveScreen
