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
import SearchScreen from '~features/search/SearchScreen'
import EditStudyScreen from '~features/studies/EditStudyScreen'
import HighlightScreen from '~features/settings/HighlightsScreen'
import DictionnaryDetailScreen from '~features/dictionnary/DictionnaryDetailScreen'

export default createStackNavigator(
  {
    MainTab: { screen: MainTabNavigator },
    BibleSelect: { screen: BibleSelectScreen },
    VersionSelector: { screen: VersionSelectorScreen },
    BibleVerseDetail: { screen: BibleVerseDetailScreen },
    BibleVerseNotes: { screen: BibleVerseNotesScreen },
    Highlights: { screen: HighlightScreen },
    BibleStrongDetail: { screen: BibleStrongDetailScreen },
    ConcordanceByBook: { screen: ConcordanceByBookScreen },
    BibleView: { screen: BibleViewScreen },
    BibleCompareVerses: { screen: BibleCompareVerses },
    Search: { screen: SearchScreen },
    EditStudy: { screen: EditStudyScreen },
    DictionnaryDetail: { screen: DictionnaryDetailScreen }
  },
  {
    headerMode: 'none'
  }
)
