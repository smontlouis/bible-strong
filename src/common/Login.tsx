import React, { useState, useEffect } from 'react'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'
import { withTheme } from '@emotion/react'
import appleAuth, { AppleButton } from '@invertase/react-native-apple-authentication'

import { toast } from 'sonner-native'
import Link from '~common/Link'
import TextInput from '~common/ui/TextInput'
import Button from '~common/ui/Button'
import Box from '~common/ui/Box'
import Spacer from '~common/ui/Spacer'
import Text from '~common/ui/Text'
import FireAuth from '~helpers/FireAuth'
import { useTranslation } from 'react-i18next'

// @ts-ignore
const SocialButton = styled.TouchableOpacity(({ theme, color }: any) => ({
  flexDirection: 'row',
  borderRadius: 48,
  height: 48,
  alignItems: 'center',
  justifyContent: 'center',
  paddingLeft: 10,
  paddingRight: 10,
  backgroundColor: color || theme.colors.reverse,
  flex: 1,
}))

const ButtonIcon = styled(Icon.FontAwesome)(() => ({
  marginRight: 15,
}))

// @ts-ignore
const ButtonText = styled(Text)(({ theme, color }: any) => ({
  fontSize: 16,
  color: color || theme.colors.default,
}))

const defaultEmail = __DEV__ ? 'test@test.com' : ''
const defaultPassword = __DEV__ ? 'testtest' : ''

const Login = ({ theme }: any) => {
  const { t } = useTranslation()
  const [isLoading, setLoading] = useState(false)
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState(defaultPassword)

  const onGoogleLogin = async () => {
    setLoading(true)
    const isStillLoading: any = await FireAuth.googleLogin()
    setLoading(isStillLoading)
  }

  // const onFacebookLogin = async () => {
  //   setLoading(true)
  //   const isStillLoading = await FireAuth.facebookLogin()
  //   setLoading(isStillLoading)
  // }

  const onLogin = async () => {
    if (!email || !password) {
      toast.error(t('Veuillez remplir les champs'))
      return false
    }
    setLoading(true)
    const isStillLoading: any = await FireAuth.login(email, password)
    setLoading(isStillLoading)
  }

  const onAppleLogin = async () => {
    setLoading(true)
    const isStillLoading: any = await FireAuth.appleLogin()
    setLoading(isStillLoading)
  }

  const resetPassword = async () => {
    if (!email) {
      toast.error(t('Veuillez remplir les champs'))
      return false
    }
    setLoading(true)
    const isStillLoading: any = await FireAuth.resetPassword(email)
    setLoading(isStillLoading)
  }

  return (
    <Box>
      <Box>
        <TextInput
          placeholder="Email"
          leftIcon={<Icon.Feather name="mail" size={20} color={theme.colors.darkGrey} />}
          onChangeText={setEmail}
          value={email}
        />
        <Spacer />
        <TextInput
          placeholder={t('Mot de passe')}
          leftIcon={<Icon.Feather name="lock" size={20} color={theme.colors.darkGrey} />}
          secureTextEntry
          onChangeText={setPassword}
          value={password}
        />
        <Box alignItems="flex-end" marginTop={10}>
          <Link onPress={resetPassword}>
            {/* @ts-ignore */}
            <Text underline>{t('Mot de passe oublié ?')}</Text>
          </Link>
        </Box>
        <Spacer size={2} />
        <Button isLoading={isLoading} onPress={onLogin}>
          {t('Connexion')}
        </Button>
      </Box>
      <Spacer />
      <Box center>
        {/* @ts-ignore */}
        <Text titleItalic fontSize={16}>
          {t('- ou -')}
        </Text>
      </Box>
      <Spacer />
      {appleAuth.isSignUpButtonSupported && (
        <AppleButton
          style={{ width: '100%', height: 50 }}
          buttonStyle={AppleButton.Style.BLACK}
          buttonType={AppleButton.Type.SIGN_IN}
          onPress={onAppleLogin}
        />
      )}
      <Spacer />
      <Box row>
        {/* @ts-ignore */}
        <SocialButton disabled={isLoading} onPress={onGoogleLogin} color="#D14C3E">
          <ButtonIcon size={20} name="google" color="white" />
          <ButtonText color="white">Google</ButtonText>
        </SocialButton>
        {/* <Box width={10} />
        <SocialButton
          disabled={isLoading}
          onPress={onFacebookLogin}
          color="#3b5998"
        >
          <ButtonIcon size={20} name="facebook" color="white" />
          <ButtonText color="white">Facebook</ButtonText>
        </SocialButton> */}
      </Box>
      <Spacer size={2} />
      <Box center pb={20}>
        <Link route="Register">
          {/* @ts-ignore */}
          <Text underline>{t('Pas de compte ? Inscrivez-vous.')}</Text>
        </Link>
      </Box>
    </Box>
  )
}

export default withTheme(Login)
