import { createMaterialTopTabNavigator } from 'react-navigation-tabs'
import BibleSelectTabBar from '~features/bible/BibleSelectTabBar'
import LocalSearchScreen from '~features/search/LocalSearchScreen'
import SearchScreen from '~features/search/SearchScreen'

import theme from '~themes/default'

const RouteConfigs = {
  SearchScreen: { screen: SearchScreen },
  LocalSearchScreen: { screen: LocalSearchScreen },
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
      backgroundColor: 'white',
    },
    indicatorStyle: {
      backgroundColor: theme.colors.primary,
    },
  },
}

export default createMaterialTopTabNavigator(RouteConfigs, TabNavigatorConfig)
