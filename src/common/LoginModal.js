import React, { useState } from 'React'
import styled from '@emotion/native'
import Modal from 'react-native-modal'

import Login from './Login'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  margin: 0
})

// More like StudiesLoginModal

const Container = styled.View(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  padding: 20
}))

const LoginModal = ({ isVisible }) => {
  return (
    <StylizedModal isVisible={isVisible} coverScreen={false}>
      <Container>
        <Text title fontSize={30} marginBottom={30}>Études bibliques</Text>
        <Paragraph scaleLineHeight={-2}>
          Rédigez vos études, sauvegardez-les dans le cloud.
        </Paragraph>
        <Paragraph scaleLineHeight={-2} marginTop={10} marginBottom={20}>
          Rejoignez la communauté !
        </Paragraph>
        <Login />
      </Container>
    </StylizedModal>
  )
}

export default LoginModal
