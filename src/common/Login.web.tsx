import * as Icon from '@expo/vector-icons'
import { useTheme } from '@emotion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Spacer from '~common/ui/Spacer'
import Text from '~common/ui/Text'
import TextInput from '~common/ui/TextInput'
import FireAuth from '~helpers/FireAuth'
import { toast } from '~helpers/toast'

const Login = () => {
  const theme = useTheme()
  const { t } = useTranslation()
  const [isLoading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const run = async (operation: () => Promise<boolean>) => {
    setLoading(true)
    setLoading(await operation())
  }

  const onLogin = () => {
    if (!email || !password) {
      toast.error(t('Veuillez remplir les champs'))
      return
    }
    void run(() => FireAuth.login(email, password))
  }

  return (
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
      <Box alignItems="flex-end" mt={10}>
        <Link route="ForgotPassword">
          <Text underline>{t('Mot de passe oublié ?')}</Text>
        </Link>
      </Box>
      <Spacer size={2} />
      <Button isLoading={isLoading} onPress={onLogin}>
        {t('Connexion')}
      </Button>
      <Spacer />
      <Box row gap={10}>
        <Box flex>
          <Button
            disabled={isLoading}
            onPress={() => void run(() => FireAuth.googleLogin())}
            color="#D14C3E"
          >
            Google
          </Button>
        </Box>
        <Box flex>
          <Button
            disabled={isLoading}
            onPress={() => void run(() => FireAuth.appleLogin())}
            color="#111111"
          >
            Apple
          </Button>
        </Box>
      </Box>
      <Spacer size={2} />
      <Box center pb={20}>
        <Link route="Register">
          <Text underline>{t('Pas de compte ? Inscrivez-vous.')}</Text>
        </Link>
      </Box>
    </Box>
  )
}

export default Login
