import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { StackScreenProps } from '@react-navigation/stack'
import { NavesTab } from '../../state/tabs'
import NaveTabScreen from './NaveTabScreen'
import { MainStackProps } from '~navigation/type'

const NaveScreen = ({
  navigation,
}: StackScreenProps<MainStackProps, 'Nave'>) => {
  const { t } = useTranslation()
  const onTheFlyAtom = useMemo(
    () =>
      atom<NavesTab>({
        id: `naves-${Date.now()}`,
        title: t('Thèmes Nave'),
        isRemovable: true,
        hasBackButton: true,
        type: 'naves',
        data: {},
      } as NavesTab),
    []
  )

  return (
    <NaveTabScreen
      navesAtom={onTheFlyAtom}
      navigation={navigation}
      hasBackButton
    />
  )
}
export default NaveScreen
