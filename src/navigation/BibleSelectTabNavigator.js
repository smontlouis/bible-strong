import { createMaterialTopTabNavigator } from 'react-navigation-tabs'
import BibleSelectTabBar from '~features/bible/BibleSelectTabBar'
import BookSelectorScreen from '~features/bible/BookSelectorScreen'
import ChapterSelectorScreen from '~features/bible/ChapterSelectorScreen'
import VerseSelectorScreen from '~features/bible/VerseSelectorScreen'

const RouteConfigs = {
  Livres: { screen: BookSelectorScreen },
  Chapitre: { screen: ChapterSelectorScreen },
  Verset: { screen: VerseSelectorScreen },
}

const TabNavigatorConfig = {
  tabBarComponent: BibleSelectTabBar,
}

export default createMaterialTopTabNavigator(RouteConfigs, TabNavigatorConfig)
