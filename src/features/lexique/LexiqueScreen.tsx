import React, { useMemo } from 'react'

import { atom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { NavigationStackScreenProps } from 'react-navigation-stack'
import { StrongsTab } from '../../state/tabs'
import LexiqueTabScreen from './LexiqueTabScreen'

interface LexiqueScreenProps {}

const LexiqueScreen = ({
  navigation,
}: NavigationStackScreenProps<LexiqueScreenProps>) => {
  const { t } = useTranslation()
  const onTheFlyAtom = useMemo(
    () =>
      atom<StrongsTab>({
        id: `strongs-${Date.now()}`,
        title: t('Lexique'),
        isRemovable: true,
        hasBackButton: true,
        type: 'strongs',
        data: {},
      } as StrongsTab),
    []
  )

  return (
    <LexiqueTabScreen
      strongsAtom={onTheFlyAtom}
      navigation={navigation}
      hasBackButton
    />
  )
}
export default LexiqueScreen
