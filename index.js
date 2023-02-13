Object.fromEntries =
  Object.fromEntries ||
  function(arr) {
    return arr.reduce(function(acc, curr) {
      acc[curr[0]] = curr[1]
      return acc
    }, {})
  }

import 'expo-asset'
import 'react-native-gesture-handler'
import { AppRegistry, Platform } from 'react-native'
import App from './App'

AppRegistry.registerComponent('main', () => App)

if (Platform.OS === 'web') {
  const rootTag =
    document.getElementById('root') || document.getElementById('main')
  AppRegistry.runApplication('main', { rootTag })
}
