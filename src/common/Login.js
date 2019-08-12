import React, { useState } from 'React'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'

import Loading from '~common/Loading'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import FireAuth from '~helpers/FireAuth'

const Button = styled.TouchableOpacity(({ theme }) => ({
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: 4,
  backgroundColor: theme.colors.reverse,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  padding: 10,
  width: 300,
  marginBottom: 20
}))

const ButtonIcon = styled(Icon.FontAwesome)(() => ({
  marginRight: 25
}))

const ButtonText = styled(Text)(() => ({
  fontSize: 16
}))

const Login = () => {
  const [isLoading, setLoading] = useState(false)

  const onGoogleLogin = async () => {
    setLoading(true)
    await FireAuth.googleLogin()
    setLoading(false)
  }

  const onFacebookLogin = async () => {
    setLoading(true)
    await FireAuth.facebookLogin()
    setLoading(false)
  }

  if (isLoading) {
    return (
      <Container>
        <Box flex center>
          <Loading />
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <Box flex center>
        <Button onPress={onGoogleLogin}>
          <ButtonIcon size={30} name='google' />
          <ButtonText>Connexion avec google</ButtonText>
        </Button>
        <Button onPress={onFacebookLogin}>
          <ButtonIcon size={30} name='facebook' />
          <ButtonText>Connexion avec facebook</ButtonText>
        </Button>
      </Box>
    </Container>
  )
}

export default Login
