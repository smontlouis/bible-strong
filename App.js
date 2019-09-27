import React from 'react'
import { YellowBox } from 'react-native'
import { AppLoading, Updates } from 'expo'
import * as Icon from '@expo/vector-icons'
import * as Font from 'expo-font'
import { Asset } from 'expo-asset'
import { Provider } from 'react-redux'
import * as Sentry from 'sentry-expo'
import { setAutoFreeze } from 'immer'

import Analytics, { screen } from '~helpers/analytics'
import SnackBar from '~common/SnackBar'
import configureStore from '~redux/store'
import InitApp from './InitApp'

setAutoFreeze(false)
YellowBox.ignoreWarnings([
  'Require cycle:',
  'LottieAnimation',
  'LottieAnimationView',
  'Setting a timer'
])

Sentry.init({
  dsn: 'https://0713ab46e07f4eaa973a160d5cd5b77d@sentry.io/1406911',
  enableInExpoDevelopment: false
})

export const { store, persistor } = configureStore()

class App extends React.Component {
  state = {
    isLoadingComplete: false
  }

  loadResourcesAsync = async () => {
    return Promise.all([
      Asset.loadAsync([require('./src/features/bible/bibleWebView/dist/index.html')]),
      Font.loadAsync({
        ...Icon.Feather.font,
        'literata-book': require('~assets/fonts/LiterataBook.otf'),
        'meta-serif-light-italic': require('~assets/fonts/metaserif_light_italic.otf'),
        'meta-serif': require('~assets/fonts/metaserif.otf')
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

  updateApp = async () => {
    try {
      const update = await Updates.checkForUpdateAsync()

      if (update.isAvailable) {
        SnackBar.show('Une mise à jour est disponible, téléchargement...')
        await Updates.fetchUpdateAsync()

        SnackBar.show("Mise à jour installée. Redémarrez l'app.")
      }
    } catch (e) {
      // handle or log error
    }
  }

  componentDidMount() {
    if (!__DEV__) {
      Analytics.hit(screen('Bible'))
    }
    this.updateApp()
  }

  render() {
    if (!this.state.isLoadingComplete) {
      return (
        <AppLoading
          startAsync={this.loadResourcesAsync}
          onError={this.handleLoadingError}
          onFinish={this.handleFinishLoading}
        />
      )
    }

    return (
      <Provider store={store}>
        <InitApp persistor={persistor} />
      </Provider>
    )
  }
}

export default App
