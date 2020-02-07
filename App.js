import 'react-native-root-siblings'
import React from 'react'
import { YellowBox, ActivityIndicator } from 'react-native'
import * as Icon from '@expo/vector-icons'
import * as Font from 'expo-font'
import { Asset } from 'expo-asset'
import { Provider } from 'react-redux'
import * as Sentry from '@sentry/react-native'
import { setAutoFreeze } from 'immer'

import Analytics, { screen } from '~helpers/analytics'
import SnackBar from '~common/SnackBar'
import Loading from '~common/Loading'
import configureStore from '~redux/store'
import InitApp from './InitApp'

setAutoFreeze(false)
YellowBox.ignoreWarnings([
  'Require cycle:',
  'LottieAnimation',
  'LottieAnimationView',
  'Setting a timer'
])

if (!__DEV__) {
  Sentry.init({
    dsn: 'https://0713ab46e07f4eaa973a160d5cd5b77d@sentry.io/1406911',
    enableInExpoDevelopment: false
  })
}

export const { store, persistor } = configureStore()

class App extends React.Component {
  state = {
    isLoadingComplete: false
  }

  async componentDidMount() {
    await this.loadResourcesAsync()
    this.handleFinishLoading()

    if (!__DEV__) {
      Analytics.hit(screen('Bible'))
    }
  }

  loadResourcesAsync = async () => {
    return Promise.all([
      Asset.loadAsync([
        require('./src/features/bible/bibleWebView/dist/index.html')
      ]),
      Font.loadAsync({
        ...Icon.Feather.font,
        'literata-book': require('~assets/fonts/LiterataBook.otf'),
        'eina-03-bold': require('~assets/fonts/eina-03-bold.otf')
      })
    ])
  }

  handleLoadingError = error => {
    // In this case, you might want to report the error to your error
    // reporting service, for example Sentry
    console.warn(error)
  }

  handleFinishLoading = () => {
    this.setState({ isLoadingComplete: true })
  }

  // updateApp = async () => {
  //   try {
  //     const update = await Updates.checkForUpdateAsync()

  //     if (update.isAvailable) {
  //       SnackBar.show('Une mise à jour est disponible, téléchargement...')
  //       await Updates.fetchUpdateAsync()

  //       SnackBar.show("Mise à jour installée. Redémarrez l'app.")
  //     }
  //   } catch (e) {
  //     // handle or log error
  //   }
  // }

  // componentDidMount() {

  //   this.updateApp()
  // }

  render() {
    if (!this.state.isLoadingComplete) {
      return <ActivityIndicator />
    }

    return (
      <Provider store={store}>
        <InitApp persistor={persistor} />
      </Provider>
    )
  }
}

export default App
