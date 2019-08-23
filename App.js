import React from 'react'
import { YellowBox } from 'react-native'
import { AppLoading, Updates } from 'expo'
import * as Segment from 'expo-analytics-segment'
import * as Icon from '@expo/vector-icons'
import * as Font from 'expo-font'
import { Asset } from 'expo-asset'
import { Provider } from 'react-redux'
import Sentry from 'sentry-expo'
import { setAutoFreeze } from 'immer'

import SnackBar from '~common/SnackBar'
import configureStore from '~redux/store'
import InitApp from './InitApp'
import { segmentConfig } from './config'

setAutoFreeze(false)
YellowBox.ignoreWarnings(['Require cycle:', 'LottieAnimation', 'LottieAnimationView'])

// if (__DEV__) {
//   Sentry.enableInExpoDevelopment = true
// }

Sentry.config('https://0713ab46e07f4eaa973a160d5cd5b77d@sentry.io/1406911').install()
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
        SnackBar.show('Nouvelle mise à jour.')
        await Updates.fetchUpdateAsync()

        Updates.reloadFromCache()
      }
    } catch (e) {
      // handle or log error
    }
  }

  componentDidMount() {
    if (!__DEV__) {
      Segment.initialize(segmentConfig)
      Segment.screen('Bible')
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
