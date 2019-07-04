import { createStackNavigator } from 'react-navigation'
import MainTabNavigator from './MainTabNavigator'
import BibleSelectScreen from '~features/bible/BibleSelectScreen'
import VersionSelectorScreen from '~features/bible/VersionSelectorScreen'
import BibleVerseDetailScreen from '~features/bible/BibleVerseDetailScreen'
import BibleVerseNotesScreen from '~features/bible/BibleVerseNotesScreen'
import BibleStrongDetailScreen from '~features/bible/BibleStrongDetailScreen'
import ConcordanceByBookScreen from '~features/bible/ConcordanceByBookScreen'
import BibleViewScreen from '~features/bible/BibleScreen'
import BibleCompareVerses from '~features/bible/BibleCompareVerses'

export default createStackNavigator(
  {
    MainTab: { screen: MainTabNavigator },
    BibleSelect: { screen: BibleSelectScreen },
    VersionSelector: { screen: VersionSelectorScreen },
    BibleVerseDetail: { screen: BibleVerseDetailScreen },
    BibleVerseNotes: { screen: BibleVerseNotesScreen },
    BibleStrongDetail: { screen: BibleStrongDetailScreen },
    ConcordanceByBook: { screen: ConcordanceByBookScreen },
    BibleView: { screen: BibleViewScreen },
    BibleCompareVerses: { screen: BibleCompareVerses }

  },
  {
    headerMode: 'none'
  }
)
