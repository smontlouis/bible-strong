import * as Icon from '@expo/vector-icons'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import analytics from '@react-native-firebase/analytics'
import * as Font from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { setAutoFreeze } from 'immer'
import React, { Suspense, useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, LogBox, StatusBar, Text, View } from 'react-native'
import PushNotification, { Importance } from 'react-native-push-notification'
import 'react-native-root-siblings'
import { Provider as ReduxProvider } from 'react-redux'
import * as Sentry from 'sentry-expo'
import AtomsPreloader from '~common/AtomsPreloader'

import { persistor, store } from '~redux/store'
import { setI18n } from './i18n'
import InitApp from './InitApp'

// Prevent native splash screen from autohiding before App component declaration
SplashScreen.preventAutoHideAsync()
  .then(result =>
    console.log(`SplashScreen.preventAutoHideAsync() succeeded: ${result}`)
  )
  .catch(console.warn) // it's good to explicitly catch and inspect any error

setAutoFreeze(false)
LogBox.ignoreLogs([
  'Require cycle',
  'LottieAnimation',
  'LottieAnimationView',
  'Setting a timer',
  'expoConstants',
  "Cannot read property 'name' of null",
  'EventEmitter.removeListener',
  'useNativeDriver',
])

if (!__DEV__) {
  Sentry.init({
    dsn: 'https://0713ab46e07f4eaa973a160d5cd5b77d@sentry.io/1406911',
  })
}

PushNotification.configure({
  onRegister() {},
  onNotification(notification) {
    notification.finish(PushNotificationIOS.FetchResult.NoData)
  },
  permissions: {
    alert: true,
    badge: true,
    sound: true,
  },
  popInitialNotification: true,
  requestPermissions: true,
})

PushNotification.createChannel(
  {
    channelId: 'vod-notifications',
    channelName: 'Notifications versets du jour',
    channelDescription: 'Notifications pour recevoir les versets du jour',
    importance: Importance.HIGH,
    playSound: true,
    vibrate: true,
  },
  created => console.log(`createChannel returned '${created}'`) // (optional) callback returns whether the channel was created, false means it already existed.
)

const loadResourcesAsync = async () => {
  return Promise.all([
    Font.loadAsync({
      ...Icon.Feather.font,
      'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
      'eina-03-bold': require('~assets/fonts/eina-03-bold.otf'),
    }),
  ])
}

const useAppLoad = () => {
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false)
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

  return { isLoadingCompleted, status }
}

const App = () => {
  const { isLoadingCompleted, status } = useAppLoad()

  const onLayoutRootView = useCallback(async () => {
    if (isLoadingCompleted) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setAppIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
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
    <ReduxProvider store={store}>
      <StatusBar translucent />
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <InitApp persistor={persistor} />
      </View>
    </ReduxProvider>
  )
}

export default App
