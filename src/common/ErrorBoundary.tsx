import * as Icon from '@expo/vector-icons'
import * as Sentry from '@sentry/react-native'
import React, { PropsWithChildren } from 'react'
import { ScrollView, TextInput, Platform, ActivityIndicator } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useTranslation } from 'react-i18next'
import { toast } from '~helpers/toast'
import * as Updates from 'expo-updates'
import { useQuery } from '~helpers/react-query-lite'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import useLogin from '~helpers/useLogin'

type ErrorBoundaryState = {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

class ErrorBoundary extends React.Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Crash captured:', error.message)

    this.setState({ errorInfo })

    Sentry.captureException(error, {
      tags: {
        error_boundary: 'true',
        error_name: error.name,
        platform: Platform.OS,
        platform_version: String(Platform.Version),
      },
      extra: {
        componentStack: errorInfo.componentStack,
        errorMessage: error.message,
        errorStack: error.stack,
      },
      level: 'fatal',
    })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} />
    }

    return this.props.children
  }
}

type ErrorFallbackProps = {
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

const ErrorFallback = ({ error, errorInfo }: ErrorFallbackProps) => {
  const { t } = useTranslation()
  const { logout } = useLogin()

  const { isLoading, data } = useQuery({
    queryKey: ['errorBoundaryUpdate'],
    queryFn: async () => {
      if (__DEV__) {
        return { updated: false }
      }

      const check = await Updates.checkForUpdateAsync()
      if (!check.isAvailable) {
        return { updated: false }
      }

      await Updates.fetchUpdateAsync()

      // Auto-reload after a short delay
      setTimeout(() => {
        Updates.reloadAsync()
      }, 1000)

      return { updated: true }
    },
  })

  const errorDetails = `
Error: ${error?.name || 'Unknown'}
Message: ${error?.message || 'No message'}

Stack Trace:
${error?.stack || 'No stack trace'}

Component Stack:
${errorInfo?.componentStack || 'No component stack'}

Platform: ${Platform.OS} ${Platform.Version}
Date: ${new Date().toISOString()}
`.trim()

  const handleCopyError = () => {
    Clipboard.setString(errorDetails)
    toast.success(t('Copié !'))
  }

  const handleReset = () => {
    logout()
    setTimeout(() => {
      Updates.reloadAsync()
    }, 1000)
  }

  return (
    <Container>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Box flex center px={20} py={40}>
          <Icon.Feather name="alert-triangle" size={80} color="#DC2626" />

          <Text bold fontSize={32} mt={20} color="quart">
            {t('app.errorTitle')}
          </Text>

          <Text textAlign="center" fontSize={15} mt={10} color="grey">
            {t('app.error')}
          </Text>

          {/* Update status */}
          {(isLoading || data?.updated) && (
            <Box
              mt={20}
              p={16}
              bg="rgba(59, 130, 246, 0.1)"
              borderRadius={8}
              borderWidth={1}
              borderColor="rgba(59, 130, 246, 0.2)"
              width="100%"
              row
              alignItems="center"
            >
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text fontSize={14} color="primary" ml={12}>
                {isLoading && t('app.updateChecking')}
                {data?.updated && t('app.updateReady')}
              </Text>
            </Box>
          )}

          {/* Error details box */}
          <Box
            mt={20}
            width="100%"
            bg="rgba(220, 38, 38, 0.05)"
            borderRadius={8}
            borderWidth={1}
            borderColor="rgba(220, 38, 38, 0.2)"
            overflow="hidden"
          >
            <Box
              row
              justifyContent="space-between"
              alignItems="center"
              px={12}
              py={8}
              bg="rgba(220, 38, 38, 0.1)"
            >
              <Text fontSize={12} bold color="quart">
                {t('app.errorDetails')}
              </Text>
              <Button small reverse onPress={handleCopyError}>
                {t('Copier')}
              </Button>
            </Box>
            <TextInput
              value={errorDetails}
              multiline
              editable={false}
              style={{
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                fontSize: 11,
                color: '#666',
                padding: 12,
                maxHeight: 150,
              }}
            />
          </Box>

          {/* Reset button */}
          <Box mt={30} width="100%">
            <Button onPress={handleReset}>{t('app.errorReset')}</Button>
          </Box>

          {/* Info message */}
          <Box
            mt={20}
            p={16}
            bg="rgba(16, 185, 129, 0.1)"
            borderRadius={8}
            borderWidth={1}
            borderColor="rgba(16, 185, 129, 0.2)"
          >
            <Box row alignItems="center" mb={8}>
              <Icon.Feather name="info" size={16} color="#10B981" />
              <Text fontSize={13} bold color="success" ml={8}>
                {t('app.errorDataSafeTitle')}
              </Text>
            </Box>
            <Text fontSize={12} color="grey" lineHeight={18}>
              {t('app.errorDataSafeMessage')}
            </Text>
          </Box>
        </Box>
      </ScrollView>
    </Container>
  )
}

export default ErrorBoundary
