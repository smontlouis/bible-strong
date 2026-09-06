import * as Icon from '@expo/vector-icons'
import * as Sentry from '@sentry/react-native'
import React, { PropsWithChildren, useEffect } from 'react'
import { ScrollView, TextInput, Platform, ActivityIndicator } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useTranslation } from 'react-i18next'
import { toast } from '~helpers/toast'
import * as Updates from 'expo-updates'
import { useMutation, useQuery } from '@tanstack/react-query'
import { remoteQueryOptions } from '~helpers/queryOptions'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import useLogin from '~helpers/useLogin'
import { appLogger } from '~helpers/agentObservability'
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
    appLogger.fatal('error-boundary', 'render.crash', {
      error,
      componentStack: errorInfo.componentStack,
    })
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

  const updateCheck = useQuery({
    queryKey: ['errorBoundaryUpdate'],
    queryFn: async () => {
      if (__DEV__) {
        return false
      }

      const check = await Updates.checkForUpdateAsync()
      return check.isAvailable
    },
    staleTime: Infinity,
    ...remoteQueryOptions,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
  const update = useMutation({
    mutationFn: async () => {
      await Updates.fetchUpdateAsync()
      return true
    },
  })
  useEffect(() => {
    if (updateCheck.data && update.isIdle) {
      update.mutate()
    }
  }, [update, updateCheck.data])
  const isLoading =
    (updateCheck.isPending && updateCheck.fetchStatus === 'fetching') ||
    (update.isPending && !update.isPaused)
  const updateReady = update.data === true

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
        <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center px-[20px] py-[40px]">
          <Icon.Feather name="alert-triangle" size={80} color="#DC2626" />

          <Text className="font-bold text-[32px] mt-[20px] text-quart">{t('app.errorTitle')}</Text>

          <Text className="text-center text-[15px] mt-[10px] text-grey">{t('app.error')}</Text>

          {/* Update status */}
          {(isLoading || updateReady) && (
            <Box className="border-continuous overflow-hidden mt-[20px] p-[16px] bg-[rgba(59,130,246,0.1)] rounded-[8px] border-[1px] border-[rgba(59,130,246,0.2)] w-[100%] flex-row items-center">
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text className="text-[14px] text-primary ml-[12px]">
                {isLoading && t('app.updateChecking')}
                {updateReady && t('app.updateReady')}
              </Text>
            </Box>
          )}

          {/* Error details box */}
          <Box className="border-continuous overflow-visible mt-[20px] w-[100%] bg-[rgba(220,38,38,0.05)] rounded-[8px] border-[1px] border-[rgba(220,38,38,0.2)]">
            <Box className="overflow-hidden border-continuous flex-row justify-between items-center px-[12px] py-[8px] bg-[rgba(220,38,38,0.1)]">
              <Text className="text-[12px] font-bold text-quart">{t('app.errorDetails')}</Text>
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
          <Box className="overflow-hidden border-continuous mt-[30px] w-[100%]">
            <Button onPress={handleReset}>{t('app.errorReset')}</Button>
          </Box>

          {/* Info message */}
          <Box className="border-continuous overflow-hidden mt-[20px] p-[16px] bg-[rgba(16,185,129,0.1)] rounded-[8px] border-[1px] border-[rgba(16,185,129,0.2)]">
            <Box className="overflow-hidden border-continuous flex-row items-center mb-[8px]">
              <Icon.Feather name="info" size={16} color="#10B981" />
              <Text className="text-[13px] font-bold text-success ml-[8px]">
                {t('app.errorDataSafeTitle')}
              </Text>
            </Box>
            <Text className="text-[12px] text-grey leading-[18px]">
              {t('app.errorDataSafeMessage')}
            </Text>
          </Box>
        </Box>
      </ScrollView>
    </Container>
  )
}

export default ErrorBoundary
