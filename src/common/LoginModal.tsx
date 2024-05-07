import styled from '@emotion/native'
import React, { useEffect, useRef } from 'react'
import { ScrollView } from 'react-native'
import Modal from 'react-native-modal'

import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Login from './Login'

import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Text from '~common/ui/Text'
import Back from './Back'
import { FeatherIcon } from './ui/Icon'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import {
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'

// More like StudiesLoginModal

const LoginModal = ({ isVisible }: { isVisible: boolean }) => {
  const { t } = useTranslation()
  const ref = useRef<BottomSheet>(null)

  return (
    <BottomSheet
      ref={ref}
      index={isVisible ? 0 : -1}
      snapPoints={['100%']}
      topInset={useSafeAreaInsets().top}
      backdropComponent={renderBackdrop}
      {...useBottomSheetStyles()}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 20 }}>
        <Box row alignItems="center" marginBottom={30}>
          <Back style={{ marginRight: 15 }}>
            <FeatherIcon name="arrow-left" size={25} />
          </Back>
          <Text title fontSize={30}>
            {t('Études bibliques')}
          </Text>
        </Box>
        <Paragraph scaleLineHeight={-2}>
          {t('Rédigez vos études, sauvegardez-les dans le cloud.')}
        </Paragraph>
        <Paragraph scaleLineHeight={-2} marginTop={10} marginBottom={20}>
          {t('Rejoignez la communauté !')}
        </Paragraph>
        <Login />
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

export default LoginModal
