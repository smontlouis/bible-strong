import { createMaterialTopTabNavigator } from 'react-navigation'
import BookSelectorScreen from '~features/bible/BookSelectorScreen'
import ChapterSelectorScreen from '~features/bible/ChapterSelectorScreen'
import VerseSelectorScreen from '~features/bible/VerseSelectorScreen'
import BibleSelectTabBar from '~features/bible/BibleSelectTabBar'

import theme from '~themes/default'

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
  tabBarComponent: BibleSelectTabBar,
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
