import { goBackOrHome } from '~navigation/goBackOrHome'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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
  const stylingTheme = useStylingTheme()

  const router = useRouter()
  const { isLogged, isSessionLost } = useLogin()
  const { t } = useTranslation()
  // A lost session still shows the account: the screen stays until the reader signs in again.
  const isSignedIn = isLogged && !isSessionLost

  useEffect(() => {
    if (isSignedIn) {
      goBackOrHome(router)
    }
  }, [isSignedIn, router])

  return (
    <Container className="bg-canvas">
      <Header hasBackButton title={t('Se connecter')} />
      <ScrollView backgroundColor="canvas">
        <Box className="overflow-hidden border-continuous p-[20px] web:w-full web:max-w-[500px] web:self-center">
          <Text
            className="text-[30px] mb-[30px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('Bienvenue !')}
          </Text>
          <Paragraph className="mb-[10px]" scaleLineHeight={-2}>
            {t('Connectez-vous pour sauvegarder toutes vos données sur le cloud !')}
          </Paragraph>
          <Login />
        </Box>
      </ScrollView>
    </Container>
  )
}
export default LoginScreen
