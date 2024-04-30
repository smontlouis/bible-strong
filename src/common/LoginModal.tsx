import styled from '@emotion/native'
import React from 'react'
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

const StylizedModal = styled(Modal)(({ theme }) => {
  const insets = useSafeAreaInsets()
  return {
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
    paddingBottom: insets.bottom,
  }
})

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
        </ScrollView>
      </Container>
    </StylizedModal>
  )
}

export default LoginModal
