import * as Icon from '@expo/vector-icons'
import analytics from '@react-native-firebase/analytics'
import * as Font from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { setAutoFreeze } from 'immer'
import { useAtomValue } from 'jotai/react'
import React, { memo, useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, LogBox, StatusBar, Text, View } from 'react-native'
import 'react-native-root-siblings'
import { Provider as ReduxProvider } from 'react-redux'
import * as Sentry from '@sentry/react-native'
import { persistor, store } from '~redux/store'
import remoteConfig from '@react-native-firebase/remote-config'

import { setI18n } from './i18n'
import InitApp from './InitApp'
import { loadableHistoryAtom } from './src/state/app'
import { loadableActiveIndexAtom, loadableTabsAtom } from './src/state/tabs'

// Prevent native splash screen from autohiding before App component declaration
SplashScreen.preventAutoHideAsync()
  .then(result =>
    console.log(`SplashScreen.preventAutoHideAsync() succeeded: ${result}`)
  )
  .catch(console.warn) // it's good to explicitly catch and inspect any error

setAutoFreeze(false)
LogBox.ignoreLogs(['Require cycle', 'EventEmitter.removeListener'])

if (!__DEV__) {
  Sentry.init({
    dsn: 'https://0713ab46e07f4eaa973a160d5cd5b77d@sentry.io/1406911',
  })
}

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
  const loadableActiveIndex = useAtomValue(loadableActiveIndexAtom)
  const loadableTabs = useAtomValue(loadableTabsAtom)
  const loadableHistory = useAtomValue(loadableHistoryAtom)

  const [status, setStatus] = useState('')
  useEffect(() => {
    ;(async () => {
      setStatus('Load resources')
      await loadResourcesAsync()
      setStatus('Set i18n')
      await setI18n()
      setIsLoadingCompleted(true)
      if (!__DEV__) {
        analytics().logScreenView({
          screen_class: 'Bible',
          screen_name: 'Bible',
        })
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      await remoteConfig().setDefaults({
        enable_tts_public: false,
        apple_reviewing: false,
      })
      const fetchedRemotely = await remoteConfig().fetchAndActivate()

      if (fetchedRemotely) {
        console.log('Configs were retrieved from the backend and activated.')
      } else {
        console.log(
          'No configs were fetched from the backend, and the local configs were already activated'
        )
      }
    })()
  }, [])

  const isCompleted =
    loadableActiveIndex.state === 'hasData' &&
    loadableTabs.state === 'hasData' &&
    loadableHistory.state === 'hasData' &&
    isLoadingCompleted

  return {
    isLoadingCompleted: isCompleted,
    status,
  }
}

const App = () => {
  const { isLoadingCompleted, status } = useAppLoad()

  const onLayoutRootView = useCallback(async () => {
    if (isLoadingCompleted) {
      await SplashScreen.hideAsync()
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
      <StatusBar translucent />
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

export default App
