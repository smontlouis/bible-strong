import React, { useEffect } from 'react'

import Text from '~common/ui/Text'
import ScrollView from '~common/ui/ScrollView'
import Paragraph from '~common/ui/Paragraph'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'
import Login from '~common/Login'
import useLogin from '~helpers/useLogin'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'

const LoginScreen = () => {
  const router = useRouter()
  const { isLogged } = useLogin()
  const { t } = useTranslation()

  useEffect(() => {
    if (isLogged) {
      router.back()
    }
  }, [isLogged, router])

  return (
    <Container>
      <Header hasBackButton title={t('Se connecter')} />
      <ScrollView>
        <Box padding={20}>
          <Text title fontSize={30} marginBottom={30}>
            {t('Bienvenue !')}
          </Text>
          <Paragraph scaleLineHeight={-2} marginBottom={10}>
            {t('Connectez-vous pour sauvegarder toutes vos données sur le cloud !')}
          </Paragraph>
          <Login />
        </Box>
      </ScrollView>
    </Container>
  )
}
export default LoginScreen
