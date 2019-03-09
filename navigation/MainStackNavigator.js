import { createStackNavigator } from 'react-navigation'
import MainTabNavigator from './MainTabNavigator'
import BibleSelectScreen from '../screens/BibleSelectScreen'
import VersionSelectorScreen from '../screens/VersionSelectorScreen'
import BibleVerseDetailScreen from '../screens/BibleVerseDetailScreen'
import BibleStrongDetailScreen from '../screens/BibleStrongDetailScreen'
import ConcordanceByBookScreen from '../screens/ConcordanceByBookScreen'
import BibleViewScreen from '../screens/BibleScreen'

export default createStackNavigator(
  {
    MainTab: { screen: MainTabNavigator },
    BibleSelect: { screen: BibleSelectScreen },
    VersionSelector: { screen: VersionSelectorScreen },
    BibleVerseDetail: { screen: BibleVerseDetailScreen },
    BibleStrongDetail: { screen: BibleStrongDetailScreen },
    ConcordanceByBook: { screen: ConcordanceByBookScreen },
    BibleView: { screen: BibleViewScreen }
  },
  {
    headerMode: 'none'
  }
)
