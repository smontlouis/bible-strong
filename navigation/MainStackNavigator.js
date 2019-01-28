import { createFluidNavigator } from 'react-navigation-fluid-transitions'
import MainTabNavigator from './MainTabNavigator'
import BibleSelectScreen from '../screens/BibleSelectScreen'
import VersionSelectorScreen from '../screens/VersionSelectorScreen'
import BibleVerseDetailScreen from '../screens/BibleVerseDetailScreen'
import BibleStrongDetailScreen from '../screens/BibleStrongDetailScreen'

export default createFluidNavigator({
  MainTab: { screen: MainTabNavigator },
  BibleSelect: { screen: BibleSelectScreen },
  VersionSelector: { screen: VersionSelectorScreen },
  BibleVerseDetail: { screen: BibleVerseDetailScreen },
  BibleStrongDetail: { screen: BibleStrongDetailScreen }
})
