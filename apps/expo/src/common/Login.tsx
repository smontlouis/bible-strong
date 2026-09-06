import { resolveThemeColor, resolveFontFamily } from '~themes/styleValues'
import {
  useTheme as useStylingTheme,
  useTheme as useAppTheme,
  withTheme,
} from '~themes/ThemeProvider'
import * as Icon from '@expo/vector-icons'
import { appleAuth, AppleButton } from '@invertase/react-native-apple-authentication'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useState } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'

import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Spacer from '~common/ui/Spacer'
import Text from '~common/ui/Text'
import TextInput from '~common/ui/TextInput'
import FireAuth from '~helpers/FireAuth'
import { toast } from '~helpers/toast'
import { Theme } from '~themes'

const SocialButton = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.TouchableOpacity>,
    keyof { color?: string } | 'theme'
  > &
    Omit<{ color?: string }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color } = props
  const classStyles = useResolveClassNames(
    twMerge(
      'flex-row rounded-[48px] h-[48px] items-center justify-center pl-[10px] pr-[10px] flex-[1]',
      className
    )
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [
          classStyles,
          { backgroundColor: color || theme.colors.reverse },
          props.style,
        ] as UIComponentProps<typeof NativeUI.TouchableOpacity>['style']
      }
    />
  )
}

const ButtonIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.FontAwesome>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('mr-[15px]', className))
  return (
    <Icon.FontAwesome
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Icon.FontAwesome>['style']}
    />
  )
}

const ButtonText = (
  componentProps: Omit<UIComponentProps<typeof Text>, keyof { color?: string } | 'theme'> &
    Omit<{ color?: string }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color } = props
  const classStyles = useResolveClassNames(twMerge('text-[16px]', className))
  return (
    <Text
      {...props}
      style={
        [classStyles, { color: color || theme.colors.default }, props.style] as UIComponentProps<
          typeof Text
        >['style']
      }
    />
  )
}

const defaultEmail = __DEV__ ? 'test@test.com' : ''
const defaultPassword = __DEV__ ? 'testtest' : ''

const Login = ({ theme }: { theme: Theme }) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const [isLoading, setLoading] = useState(false)
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState(defaultPassword)
  const [customToken, setCustomToken] = useState('')

  const onGoogleLogin = async () => {
    setLoading(true)
    const isStillLoading = await FireAuth.googleLogin()
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
    const isStillLoading = await FireAuth.login(email, password)
    setLoading(isStillLoading)
  }

  const onAppleLogin = async () => {
    setLoading(true)
    const isStillLoading = await FireAuth.appleLogin()
    setLoading(isStillLoading)
  }

  const onCustomTokenLogin = async () => {
    if (!customToken.trim()) {
      toast.error('Veuillez coller un token')
      return
    }
    setLoading(true)
    const isStillLoading = await FireAuth.loginWithCustomToken(customToken.trim())
    setLoading(isStillLoading)
  }

  return (
    <Box className="overflow-hidden border-continuous">
      <Box className="overflow-hidden border-continuous">
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
        <Box className="overflow-hidden border-continuous items-end mt-[10px]">
          <Link route="ForgotPassword">
            <Text
              style={{
                textDecorationLine: 'underline',
                textDecorationStyle: 'solid',
                textDecorationColor: resolveThemeColor(stylingTheme, 'default'),
              }}
            >
              {t('Mot de passe oublié ?')}
            </Text>
          </Link>
        </Box>
        <Spacer size={2} />
        <Button isLoading={isLoading} onPress={onLogin}>
          {t('Connexion')}
        </Button>
      </Box>
      <Spacer />
      <Box className="overflow-hidden border-continuous items-center justify-center">
        <Text
          className="text-[16px]"
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.titleItalic) }}
        >
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
      <Box className="overflow-hidden border-continuous flex-row">
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
      <Box className="overflow-hidden border-continuous items-center justify-center pb-[20px]">
        <Link route="Register">
          <Text
            style={{
              textDecorationLine: 'underline',
              textDecorationStyle: 'solid',
              textDecorationColor: resolveThemeColor(stylingTheme, 'default'),
            }}
          >
            {t('Pas de compte ? Inscrivez-vous.')}
          </Text>
        </Link>
      </Box>
      {__DEV__ && (
        <>
          <Box className="overflow-hidden border-continuous h-[1px] bg-light-grey my-[20px]" />
          <Text className="font-bold text-dark-grey text-[12px] mb-[10px]">
            🔧 DEBUG: Custom Token Login
          </Text>
          <TextInput
            placeholder="Coller le custom token ici"
            onChangeText={setCustomToken}
            value={customToken}
          />
          <Spacer />
          <Button isLoading={isLoading} onPress={onCustomTokenLogin} secondary>
            Login with Token
          </Button>
        </>
      )}
    </Box>
  )
}

export default withTheme(Login)
