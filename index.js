Object.fromEntries =
  Object.fromEntries ||
  function(arr) {
    return arr.reduce(function(acc, curr) {
      acc[curr[0]] = curr[1]
      return acc
    }, {})
  }

import 'expo-asset'
import { AppRegistry, Platform } from 'react-native'
import App from './App'

AppRegistry.registerComponent('biblestrong', () => App)

if (Platform.OS === 'web') {
  const rootTag =
    document.getElementById('root') || document.getElementById('main')
  AppRegistry.runApplication('biblestrong', { rootTag })
}
