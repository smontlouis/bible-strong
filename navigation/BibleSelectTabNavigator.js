import { createMaterialTopTabNavigator } from 'react-navigation'
import BookSelectorScreen from '../screens/BookSelectorScreen'
import ChapterSelectorScreen from '../screens/ChapterSelectorScreen'
import VerseSelectorScreen from '../screens/VerseSelectorScreen'

import theme from '../themes/default'

const RouteConfigs = {
  Livres: { screen: BookSelectorScreen },
  Chapitre: { screen: ChapterSelectorScreen },
  Verset: { screen: VerseSelectorScreen }
}

const TabNavigatorConfig = {
  optimizationsEnabled: true,
  swipeEnabled: true,
  animationEnabled: true,
  pressColor: 'black',
  tabBarOptions: {
    upperCaseLabel: false,
    activeTintColor: theme.colors.primary,
    inactiveTintColor: 'black',
    style: {
      backgroundColor: 'white'
    },
    indicatorStyle: {
      backgroundColor: theme.colors.primary
    }
  }
}

export default createMaterialTopTabNavigator(RouteConfigs, TabNavigatorConfig)
