import 'react-native-root-siblings'
import React, { useState, useEffect } from 'react'
import { LogBox, ActivityIndicator, View, StatusBar, Text } from 'react-native'
import * as Icon from '@expo/vector-icons'
import * as Font from 'expo-font'
import { Provider } from 'react-redux'
import * as Sentry from 'sentry-expo'
import { setAutoFreeze } from 'immer'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import PushNotification, { Importance } from 'react-native-push-notification'
import analytics from '@react-native-firebase/analytics'

import { store, persistor } from '~redux/store'
import { GlobalContext } from '~helpers/globalContext'
import InitApp from './InitApp'
import { useInitIAP } from '~helpers/useInAppPurchases'
import { setI18n } from './i18n'

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
      // setStatus('load resources')
      // await loadResourcesAsync()
      setStatus('Set i18n')
      await setI18n()
      setStatus('Done')
      handleFinishLoading()

      if (!__DEV__) {
        analytics().logScreenView({
          screen_class: 'Bible',
          screen_name: 'Bible',
        })
      }
    })()
  }, [])

  const handleFinishLoading = () => {
    setIsLoadingCompleted(true)
  }

  return { isLoadingCompleted, status }
}

const useGlobalState = () => {
  const fullscreen = React.useState(false)
  const iap = React.useState(false)
  const connection = React.useState(true)
  const premiumModal = React.useState(false)

  const globalStore = {
    fullscreen,
    iap,
    connection,
    premiumModal,
  }

  return globalStore
}

const App = () => {
  const { isLoadingCompleted, status } = useAppLoad()
  const globalStore = useGlobalState()
  useInitIAP(globalStore)

  if (!isLoadingCompleted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text>{status}</Text>
      </View>
    )
  }

  return (
    <GlobalContext.Provider value={globalStore}>
      <Provider store={store}>
        <StatusBar translucent />
        <InitApp persistor={persistor} />
      </Provider>
    </GlobalContext.Provider>
  )
}

export default App
