import React, { useMemo } from 'react'

import { atom } from 'jotai'
import { NavigationStackScreenProps } from 'react-navigation-stack'
import { StrongsTab } from '~state/tabs'
import LexiqueTabScreen from './LexiqueTabScreen'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import { getBottomSpace } from 'react-native-iphone-x-helper'

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
    <Box flex={1} bg="reverse" paddingBottom={getBottomSpace()}>
      <LexiqueTabScreen
        strongsAtom={onTheFlyAtom}
        navigation={navigation}
        hasBackButton
      />
    </Box>
  )
}
export default LexiqueScreen
