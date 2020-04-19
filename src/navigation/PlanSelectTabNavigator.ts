import { createMaterialTopTabNavigator } from 'react-navigation-tabs'
import MyPlanListScreen from '~features/plans/MyPlanListScreen/MyPlanListScreen'
import ExploreScreen from '~features/plans/Explore/ExploreScreen'
import BibleSelectTabBar from '~features/bible/BibleSelectTabBar'

import theme from '~themes/default'

const RouteConfigs = {
  Plans: { screen: MyPlanListScreen },
  Explorer: { screen: ExploreScreen },
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
