import { createMaterialTopTabNavigator } from 'react-navigation-tabs'
import BibleSelectTabBar from '~features/bible/BibleSelectTabBar'
import LocalSearchScreen from '~features/search/LocalSearchScreen'
import SearchScreen from '~features/search/SearchScreen'

const RouteConfigs = {
  SearchScreen: { screen: SearchScreen },
  LocalSearchScreen: { screen: LocalSearchScreen },
}

const TabNavigatorConfig = {
  lazy: true,
  tabBarComponent: BibleSelectTabBar,
}

export default createMaterialTopTabNavigator(RouteConfigs, TabNavigatorConfig)
