import * as Icon from '@expo/vector-icons'
import * as Sentry from '@sentry/react-native'
import React from 'react'
import RNRestart from 'react-native-restart'

import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import useLogin from '~helpers/useLogin'

class ErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.log('[Common] Error:', error)
    Sentry.captureException(error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container>
          <Box center flex>
            <Box center paddingHorizontal={30}>
              <Icon.Feather name="x-circle" size={100} color="rgb(194,40,57)" />
              <Text bold fontSize={60}>
                OOPS
              </Text>
              <AppCrashedText />
              <LogoutButton />
            </Box>
          </Box>
        </Container>
      )
    }

    return this.props.children
  }
}

const AppCrashedText = () => {
  const { t } = useTranslation()
  return (
    <Text textAlign="center" fontSize={14}>
      {t('app.error')}
    </Text>
  )
}

const LogoutButton = () => {
  const { t } = useTranslation()
  const { logout } = useLogin()
  return (
    <Box mt={20}>
      <Button
        small
        onPress={() => {
          logout()
          setTimeout(() => {
            RNRestart.Restart()
          }, 1000)
        }}
      >
        {t('Se déconnecter')}
      </Button>
      <Button
        small
        style={{ marginTop: 10 }}
        onPress={() => {
          setTimeout(() => {
            RNRestart.Restart()
          }, 1000)
        }}
      >
        {t('Redémarrer')}
      </Button>
    </Box>
  )
}
export default ErrorBoundary
