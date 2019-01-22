import { createStackNavigator } from 'react-navigation'

import MainTabNavigator from './MainTabNavigator'
import BibleSelect from '../screens/BibleSelect'

export default createStackNavigator({
  Main: { screen: MainTabNavigator },
  BibleSelect: { screen: BibleSelect }
})
