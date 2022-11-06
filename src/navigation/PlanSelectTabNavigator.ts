import { createMaterialTopTabNavigator } from 'react-navigation-tabs'
import BibleSelectTabBar from '~features/bible/BibleSelectTabBar'
import ExploreScreen from '~features/plans/Explore/ExploreScreen'
import MyPlanListScreen from '~features/plans/MyPlanListScreen/MyPlanListScreen'

const RouteConfigs = {
  Plans: { screen: MyPlanListScreen },
  Explorer: { screen: ExploreScreen },
}

const TabNavigatorConfig = {
  tabBarComponent: BibleSelectTabBar,
}

export default createMaterialTopTabNavigator(RouteConfigs, TabNavigatorConfig)
