import React from 'react'
import { AppLoading, Font, Icon, FileSystem, Asset } from 'expo'
import { Provider } from 'react-redux'
import { ThemeProvider } from 'emotion-theming'

import theme from './themes/default'
import AppNavigator from './navigation/AppNavigator'
import configureStore from './redux/store'
import { initDB } from './helpers/database'

export const store = configureStore()

export default class App extends React.Component {
  state = {
    isLoadingComplete: false
  }

  loadResourcesAsync = async () => {
    const sqliteDirPath = `${FileSystem.documentDirectory}SQLite`
    const sqliteDir = await FileSystem.getInfoAsync(sqliteDirPath)

    if (!sqliteDir.exists) {
      await FileSystem.makeDirectoryAsync(sqliteDirPath)
    } else if (!sqliteDir.isDirectory) {
      throw new Error('SQLite dir is not a directory')
    }

    const dbPath = `${sqliteDirPath}/strong.sqlite`

    const dbFile = await FileSystem.getInfoAsync(dbPath)

    if (!dbFile.exists) {
      const dbUri = Asset.fromModule(require(`./assets/db/strong.sqlite`)).uri
      console.log(`Downloading ${dbUri} to ${dbPath}`)
      await FileSystem.downloadAsync(dbUri, dbPath)
    }

    initDB()

    return Promise.all([
      Asset.loadAsync([
        require('./assets/images/robot-dev.png'),
        require('./assets/images/robot-prod.png')
      ]),
      Font.loadAsync({
        ...Icon.Ionicons.font
        // 'alternate-gothic': require('./assets/fonts/alternategothic.ttf'),
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
