import { createMaterialTopTabNavigator } from 'react-navigation-tabs'
import SelectTabBar from '~common/SelectTabBar'
import ExploreScreen from '~features/plans/Explore/ExploreScreen'
import MyPlanListScreen from '~features/plans/MyPlanListScreen/MyPlanListScreen'

const RouteConfigs = {
  Plans: { screen: MyPlanListScreen },
  Explorer: { screen: ExploreScreen },
}

const TabNavigatorConfig = {
  tabBarComponent: SelectTabBar,
}

export default createMaterialTopTabNavigator(RouteConfigs, TabNavigatorConfig)
