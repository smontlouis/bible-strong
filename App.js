import 'react-native-root-siblings'
import React from 'react'
import { YellowBox, ActivityIndicator, View, StatusBar } from 'react-native'
import * as Icon from '@expo/vector-icons'
import * as Font from 'expo-font'
import { Provider } from 'react-redux'
import * as Sentry from '@sentry/react-native'
import { setAutoFreeze } from 'immer'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import PushNotification from 'react-native-push-notification'
import analytics from '@react-native-firebase/analytics'

import SplashScreen from 'react-native-splash-screen'

import configureStore from '~redux/store'
import GlobalContext from '~helpers/globalContext'
import InitApp from './InitApp'

setAutoFreeze(false)
YellowBox.ignoreWarnings([
  'Require cycle:',
  'LottieAnimation',
  'LottieAnimationView',
  'Setting a timer',
  'expoConstants',
  "Cannot read property 'name' of null",
])

if (!__DEV__) {
  Sentry.init({
    dsn: 'https://0713ab46e07f4eaa973a160d5cd5b77d@sentry.io/1406911',
  })
}

export const { store, persistor } = configureStore()

class App extends React.Component {
  state = {
    isLoadingComplete: false,
    isFullscreen: false,
  }

  async componentDidMount() {
    await this.loadResourcesAsync()
    this.handleFinishLoading()

    if (!__DEV__) {
      analytics().setCurrentScreen('Bible', 'Bible')
    }

    this.initNotifications()
  }

  initNotifications = () => {
    PushNotification.configure({
      // (optional) Called when Token is generated (iOS and Android)
      onRegister(token) {
        console.log('TOKEN:', token)
      },

      // (required) Called when a remote or local notification is opened or received
      onNotification(notification) {
        console.log('NOTIFICATION:', notification)

        // process the notification

        // required on iOS only (see fetchCompletionHandler docs: https://github.com/react-native-community/react-native-push-notification-ios)
        notification.finish(PushNotificationIOS.FetchResult.NoData)
      },

      // ANDROID ONLY: GCM or FCM Sender ID (product_number) (optional - not required for local notifications, but is need to receive remote push notifications)
      senderID: 'YOUR GCM (OR FCM) SENDER ID',

      // IOS ONLY (optional): default: all - Permissions to register.
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      // Should the initial notification be popped automatically
      // default: true
      popInitialNotification: true,

      /**
       * (optional) default: true
       * - Specified if permissions (ios) and token (android and ios) will requested or not,
       * - if not, you must call PushNotificationsHandler.requestPermissions() later
       */
      requestPermissions: true,
    })
  }

  loadResourcesAsync = async () => {
    return Promise.all([
      Font.loadAsync({
        ...Icon.Feather.font,
        'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
        'eina-03-bold': require('~assets/fonts/eina-03-bold.otf'),
      }),
    ])
  }

  updateState = (key, val) => {
    this.setState({ [key]: val })
  }

  handleLoadingError = error => {
    // In this case, you might want to report the error to your error
    // reporting service, for example Sentry
    console.warn(error)
  }

  handleFinishLoading = () => {
    this.setState({ isLoadingComplete: true })
    SplashScreen.hide()
  }

  render() {
    if (!this.state.isLoadingComplete) {
      return (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator />
        </View>
      )
    }

    return (
      <GlobalContext.Provider
        value={{ state: this.state, updateState: this.updateState }}
      >
        <Provider store={store}>
          <StatusBar translucent />
          <InitApp persistor={persistor} />
        </Provider>
      </GlobalContext.Provider>
    )
  }
}

export default App
