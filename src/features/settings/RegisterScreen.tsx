import React, { useEffect, useState } from 'react'
import { useTheme } from '@emotion/react'
import * as Icon from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import FireAuth from '~helpers/FireAuth'
import useLogin from '~helpers/useLogin'
import Button from '~common/ui/Button'
import ScrollView from '~common/ui/ScrollView'
import TextInput from '~common/ui/TextInput'
import Spacer from '~common/ui/Spacer'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'
import { toast } from 'sonner-native'
import { useTranslation } from 'react-i18next'

const RegisterScreen = () => {
  const theme = useTheme()
  const router = useRouter()
  const { isLogged } = useLogin()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setLoading] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    if (isLogged) {
      // Go back two screens (register -> login -> previous)
      router.dismiss(2)
    }
  }, [isLogged, router])

  const onRegister = async () => {
    if (!username || !email || !password) {
      toast(t('Veuillez remplir les champs'))
      return false
    }
    setLoading(true)
    const isStillLoading = await FireAuth.register(username, email, password)
    // @ts-ignore
    setLoading(isStillLoading)
  }

  return (
    <Container>
      <Header hasBackButton title={t('Créer un compte')} />
      <ScrollView>
        <Box padding={20}>
          <TextInput
            placeholder={t('Nom')}
            leftIcon={<Icon.Feather name="user" size={20} color={theme.colors.darkGrey} />}
            onChangeText={setUsername}
          />
          <Spacer />
          <TextInput
            placeholder="Email"
            leftIcon={<Icon.Feather name="mail" size={20} color={theme.colors.darkGrey} />}
            onChangeText={setEmail}
          />
          <Spacer />
          <TextInput
            placeholder={t('Mot de passe')}
            leftIcon={<Icon.Feather name="lock" size={20} color={theme.colors.darkGrey} />}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Spacer size={2} />
          <Button onPress={onRegister} isLoading={isLoading}>
            {t('Créer mon compte')}
          </Button>
        </Box>
      </ScrollView>
    </Container>
  )
}
export default RegisterScreen
