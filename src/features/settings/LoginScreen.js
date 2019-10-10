import React, { useEffect } from 'react'

import Text from '~common/ui/Text'
import ScrollView from '~common/ui/ScrollView'
import Paragraph from '~common/ui/Paragraph'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'
import Login from '~common/Login'
import useLogin from '~helpers/useLogin'

const LoginScreen = ({ navigation }) => {
  const { isLogged } = useLogin()

  useEffect(() => {
    if (isLogged) {
      navigation.goBack()
    }
  }, [isLogged, navigation])

  return (
    <Container>
      <Header hasBackButton title="Se connecter" />
      <ScrollView>
        <Box padding={20}>
          <Text title fontSize={30} marginBottom={30}>
            Bienvenue !
          </Text>
          <Paragraph scaleLineHeight={-2} marginBottom={20}>
            Connectez-vous pour sauvegarder toutes vos données sur le cloud !
          </Paragraph>
          <Login />
        </Box>
      </ScrollView>
    </Container>
  )
}
export default LoginScreen
