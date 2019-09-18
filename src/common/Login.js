import React, { useState } from 'React'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'

import Loading from '~common/Loading'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import FireAuth from '~helpers/FireAuth'

const Button = styled.TouchableOpacity(({ theme, color }) => ({
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: 4,
  backgroundColor: color || theme.colors.reverse,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 3,
  elevation: 1,
  padding: 10,
  width: 160,
  marginBottom: 20
}))

const ButtonIcon = styled(Icon.FontAwesome)(() => ({
  marginRight: 15
}))

const ButtonText = styled(Text)(({ theme, color }) => ({
  fontSize: 16,
  color: color || theme.colors.defaut
}))

const Login = () => {
  const [isLoading, setLoading] = useState(false)

  const onGoogleLogin = async () => {
    setLoading(true)
    const isStillLoading = await FireAuth.googleLogin()
    setLoading(isStillLoading)
  }

  const onFacebookLogin = async () => {
    setLoading(true)
    const isStillLoading = await FireAuth.facebookLogin()
    setLoading(isStillLoading)
  }

  if (isLoading) {
    return (
      <Box height={60} center>
        <Loading />
      </Box>
    )
  }

  return (
    <Box marginTop={20} height={60} row justifyContent="space-between">
      <Button onPress={onGoogleLogin} color="#D14C3E">
        <ButtonIcon size={20} name="google" color="white" />
        <ButtonText color="white">Google</ButtonText>
      </Button>
      <Button onPress={onFacebookLogin} color="#3b5998">
        <ButtonIcon size={20} name="facebook" color="white" />
        <ButtonText color="white">Facebook</ButtonText>
      </Button>
    </Box>
  )
}

export default Login
