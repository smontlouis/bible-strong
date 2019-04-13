import React from 'react'
import { YellowBox } from 'react-native'
import { AppLoading, Font, Icon, Updates } from 'expo'
import { Provider } from 'react-redux'
import { ThemeProvider } from 'emotion-theming'
import Sentry from 'sentry-expo'
import SnackBar from '~common/SnackBar'

import theme from '~themes/default'
import AppNavigator from '~navigation/AppNavigator'
import configureStore from '~redux/store'

YellowBox.ignoreWarnings(['Require cycle:'])

// if (__DEV__) {
//   Sentry.enableInExpoDevelopment = true
// }
Sentry.config(
  'https://0713ab46e07f4eaa973a160d5cd5b77d@sentry.io/1406911'
).install()
export const store = configureStore()

export default class App extends React.Component {
  state = {
    isLoadingComplete: false
  }

  loadResourcesAsync = async () => {
    return Promise.all([
      Font.loadAsync({
        ...Icon.Ionicons.font,
        'meta-serif-bold-italic': require('~assets/fonts/metaserif_bold_italic.otf'),
        'meta-serif-light-italic': require('~assets/fonts/metaserif_light_italic.otf'),
        'meta-serif-light': require('~assets/fonts/metaserif_light.otf'),
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
      SnackBar.show('Recherche de mise à jour...', { duration: 3000 })
      const update = await Updates.checkForUpdateAsync()

      if (update.isAvailable) {
        SnackBar.show('Téléchargement...', { duration: 3000 })
        await Updates.fetchUpdateAsync()

        Updates.reloadFromCache()
      }
    } catch (e) {
      // handle or log error
    }
  }

  componentDidMount () {
    this.updateApp()
  }

  render () {
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
      <ThemeProvider theme={theme}>
        <Provider store={store}>
          <AppNavigator />
        </Provider>
      </ThemeProvider>
    )
  }
}
