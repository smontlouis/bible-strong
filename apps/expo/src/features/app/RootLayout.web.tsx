import { ThemeProvider } from '@emotion/react'
import * as Sentry from '@sentry/react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import { setAutoFreeze } from 'immer'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Provider as ReduxProvider, useSelector } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'

import ErrorBoundary from '~common/ErrorBoundary'
import FullAppRuntime from '~features/app/FullAppRuntime'
import { ResourceAccessProvider } from '~features/resources/resourceAccess'
import { configureQueryManagers, queryClient } from '~helpers/queryClient'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import type { RootState } from '~redux/modules/reducer'
import { persistor, startPersistence, store } from '~redux/store'
import getTheme, { baseTheme } from '~themes/index'
import { setI18n } from '../../../i18n'

setAutoFreeze(false)

const Loading = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator />
  </View>
)

const InnerApp = () => {
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const { theme: selectedTheme } = useCurrentThemeSelector()
  const selected = getTheme[selectedTheme] || baseTheme
  const theme = {
    ...selected,
    fontFamily: { ...selected.fontFamily, paragraph: fontFamily },
  }

  return (
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <PersistGate loading={<Loading />} persistor={persistor}>
          <ErrorBoundary>
            <ResourceAccessProvider>
              <FullAppRuntime theme={theme} />
            </ResourceAccessProvider>
          </ErrorBoundary>
        </PersistGate>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

const RootLayout = () => {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    configureQueryManagers()
    setI18n().then(() => {
      startPersistence()
      if (active) setReady(true)
    })
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      sampleRate: 0.5,
    })
    return () => {
      active = false
    }
  }, [])

  if (!ready) return <Loading />

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ReduxProvider store={store}>
          <InnerApp />
        </ReduxProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

export default Sentry.wrap(RootLayout)
