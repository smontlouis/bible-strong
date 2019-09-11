import React from 'react'
import styled from '@emotion/native'
import Modal from 'react-native-modal'
import * as Icon from '@expo/vector-icons'

import Login from './Login'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import Back from '~common/Back'
import app from '../../app.json'

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
  const isUpdated = app.expo.sdkVersion.includes('34')
  return (
    <StylizedModal isVisible={isVisible} coverScreen={false}>
      <Container>
        <Box row alignItems="center" marginBottom={30}>
          <Back style={{ marginRight: 15 }}>
            <Icon.Feather name="arrow-left" size={25} />
          </Back>
          <Text title fontSize={30}>
            Études bibliques (bêta)
          </Text>
        </Box>
        <Paragraph scaleLineHeight={-2}>
          Rédigez vos études, sauvegardez-les dans le cloud.
        </Paragraph>
        <Paragraph scaleLineHeight={-2} marginTop={10}>
          Rejoignez la communauté !
        </Paragraph>
        <Paragraph scale={-3} scaleLineHeight={-1} marginTop={10} marginBottom={20}>
          Cette version est en bêta test. Merci de me donner le plus de retours possibles 😉.
        </Paragraph>
        {isUpdated ? (
          <Login />
        ) : (
          <Paragraph scale={-2} scaleLineHeight={-2}>
            Merci de mettre à jour votre application pour utiliser les études.
          </Paragraph>
        )}
      </Container>
    </StylizedModal>
  )
}

export default LoginModal
