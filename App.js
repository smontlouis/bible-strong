import React from 'react'
import { AppLoading, Font, Icon, FileSystem, Asset } from 'expo'
import { Provider } from 'react-redux'

import AppNavigator from './navigation/AppNavigator'
import configureStore from './redux/store'

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

    return Promise.all([
      Asset.loadAsync([
        require('./assets/images/robot-dev.png'),
        require('./assets/images/robot-prod.png')
      ]),
      Font.loadAsync({
        // This is the font that we are using for our tab bar
        ...Icon.Ionicons.font,
        // We include SpaceMono because we use it in HomeScreen.js. Feel free
        // to remove this if you are not using it in your app
        'space-mono': require('./assets/fonts/SpaceMono-Regular.ttf')
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
      <Provider store={store}>
        <AppNavigator />
      </Provider>
    )
  }
}
