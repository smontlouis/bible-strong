import React from 'react'
import styled from '@emotion/native'
import Modal from 'react-native-modal'
import { ScrollView } from 'react-native'
import { getBottomSpace } from 'react-native-iphone-x-helper'

import Login from './Login'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'

import Text from '~common/ui/Text'
import { useTranslation } from 'react-i18next'

const StylizedModal = styled(Modal)(({ theme }) => ({
  justifyContent: 'flex-end',
  margin: 0,
  maxWidth: 600,
  marginLeft: 'auto',
  marginRight: 'auto',
  width: '100%',
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  paddingBottom: getBottomSpace(),
}))

// More like StudiesLoginModal

const Container = styled.View(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  padding: 20,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
}))

const LoginModal = ({ isVisible }) => {
  const { t } = useTranslation()
  return (
    <StylizedModal isVisible={isVisible} coverScreen={false}>
      <Container>
        <ScrollView>
          <Box row alignItems="center" marginBottom={30}>
            {/* <Back style={{ marginRight: 15 }}>
            <Icon.Feather name="arrow-left" size={25} />
          </Back> */}
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
        </ScrollView>
      </Container>
    </StylizedModal>
  )
}

export default LoginModal
