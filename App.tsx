import * as Icon from '@expo/vector-icons'
import analytics from '@react-native-firebase/analytics'
import * as Sentry from '@sentry/react-native'
import * as Font from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { setAutoFreeze } from 'immer'
import React, { memo, useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, LogBox, StatusBar, Text, View } from 'react-native'
import 'react-native-root-siblings'
import { Provider as ReduxProvider } from 'react-redux'
import { persistor, store } from '~redux/store'

import { configureReanimatedLogger } from 'react-native-reanimated'
import { ignoreSentryErrors } from '~helpers/ignoreSentryErrors'
import { checkDatabasesStorage } from '~helpers/sqlite'
import { useMigrateFromAsyncStorage } from '~helpers/storage'
import { useRemoteConfig } from '~helpers/useRemoteConfig'
import InitApp from './InitApp'
import { setI18n } from './i18n'
import { SystemBars } from 'react-native-edge-to-edge'

configureReanimatedLogger({
  strict: false,
})

// Prevent native splash screen from autohiding before App component declaration
SplashScreen.preventAutoHideAsync()
  .then((result) =>
    console.log(`SplashScreen.preventAutoHideAsync() succeeded: ${result}`)
  )
  .catch(console.warn) // it's good to explicitly catch and inspect any error

SplashScreen.setOptions({
  duration: 1000,
  fade: true,
})

setAutoFreeze(false)
LogBox.ignoreLogs(['Require cycle', 'EventEmitter.removeListener'])

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // debug: __DEV__,
  sampleRate: 0.5,
  ignoreErrors: ignoreSentryErrors,
})

const loadResourcesAsync = async () => {
  return Promise.all([
    Font.loadAsync({
      ...Icon.Feather.font,
      ...Icon.Ionicons.font,
      'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
      'eina-03-bold': require('~assets/fonts/eina-03-bold.otf'),
    }),
  ])
}

const useAppLoad = () => {
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false)
  const hasMigrated = useMigrateFromAsyncStorage()

  const [status, setStatus] = useState('')
  useEffect(() => {
    ;(async () => {
      setStatus('Load resources')
      await loadResourcesAsync()
      setStatus('Set i18n')
      await setI18n()
      await checkDatabasesStorage()
      setIsLoadingCompleted(true)
      if (!__DEV__) {
        analytics().logScreenView({
          screen_class: 'Bible',
          screen_name: 'Bible',
        })
      }
    })()
  }, [])

  useRemoteConfig()

  const isCompleted = isLoadingCompleted && hasMigrated

  return {
    isLoadingCompleted: isCompleted,
    status,
  }
}

const App = () => {
  const { isLoadingCompleted, status } = useAppLoad()

  const onLayoutRootView = useCallback(() => {
    if (isLoadingCompleted) {
      SplashScreen.hide()
    }
  }, [isLoadingCompleted])

  if (!isLoadingCompleted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text>{status}</Text>
      </View>
    )
  }

  return (
    <>
      <SystemBars style="light" />
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <InitAppWrapper />
      </View>
    </>
  )
}

const InitAppWrapper = memo(() => {
  return (
    <ReduxProvider store={store}>
      <InitApp persistor={persistor} />
    </ReduxProvider>
  )
})

export default Sentry.wrap(App)
