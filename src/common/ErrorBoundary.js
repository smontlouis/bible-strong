import React from 'react'
import * as Icon from '@expo/vector-icons'
import * as Sentry from 'sentry-expo'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

class ErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.log(error)
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
              <Text textAlign="center" fontSize={14}>
                {
                  "Désolé, l'app vient de planter...\nLe développeur en a été informé. Merci de redémarrer l'app."
                }
              </Text>
            </Box>
          </Box>
        </Container>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
