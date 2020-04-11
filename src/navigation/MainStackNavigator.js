import { createStackNavigator } from 'react-navigation-stack'

import MainTabNavigator from './MainTabNavigator'
import BibleSelectScreen from '~features/bible/BibleSelectScreen'
import VersionSelectorScreen from '~features/bible/VersionSelectorScreen'
import BibleVerseDetailScreen from '~features/bible/BibleVerseDetailScreen'
import BibleVerseNotesScreen from '~features/bible/BibleVerseNotesScreen'
import BibleStrongDetailScreen from '~features/bible/BibleStrongDetailScreen'
import ConcordanceByBookScreen from '~features/bible/ConcordanceByBookScreen'
import BibleViewScreen from '~features/bible/BibleScreen'
import BibleCompareVerses from '~features/bible/BibleCompareVerses'
import LexiqueScreen from '~features/lexique/LexiqueScreen'
import StudiesScreen from '~features/studies/StudiesScreen'
import EditStudyScreen from '~features/studies/EditStudyScreen'
import HighlightScreen from '~features/settings/HighlightsScreen'
import DictionnaryDetailScreen from '~features/dictionnary/DictionnaryDetailScreen'
import DictionnaryScreen from '~features/dictionnary/DictionnaryScreen'
import DictionnaireVerseDetailScreen from '~features/dictionnary/DictionnaireVerseDetailScreen'
import LoginScreen from '~features/settings/LoginScreen'
import RegisterScreen from '~features/settings/RegisterScreen'
import SupportScreen from '~features/settings/SupportScreen'
import FAQScreen from '~features/settings/FAQScreen'
import ModifyColorsScreen from '../features/settings/ModifyColorsScreen'
import ChangelogScreen from '../features/settings/ChangelogScreen'
import PericopeScreen from '../features/bible/PericopeScreen'
import HistoryScreen from '~features/bible/HistoryScreen'
import TagsScreen from '../features/settings/TagsScreen'
import TagScreen from '../features/settings/TagScreen'
import DownloadsScreen from '../features/settings/DownloadsScreen'
import SearchScreen from '~features/search/SearchScreen'
import NaveScreen from '~features/nave/NaveScreen'
import NaveDetailScreen from '~features/nave/NaveDetailScreen'
import NaveWarningScreen from '~features/nave/NaveWarningScreen'
import ToggleCompareVersesScreen from '~features/bible/ToggleCompareVersesScreen'
import StorybookScreen from '../../storybook/StoryBookScreen'
import PlanScreen from '~features/plans/PlanScreen/PlanScreen'
import MyPlanListScreen from '~features/plans/MyPlanListScreen/MyPlanListScreen'
import PlanSliceScreen from '~features/plans/PlanSliceScreen/PlanSliceScreen'

export default createStackNavigator(
  {
    MainTab: { screen: MainTabNavigator },
    BibleSelect: { screen: BibleSelectScreen },
    VersionSelector: { screen: VersionSelectorScreen },
    BibleVerseDetail: { screen: BibleVerseDetailScreen },
    BibleVerseNotes: { screen: BibleVerseNotesScreen },
    Highlights: { screen: HighlightScreen },
    BibleStrongDetail: { screen: BibleStrongDetailScreen },
    DictionnaireVerseDetail: { screen: DictionnaireVerseDetailScreen },
    ConcordanceByBook: { screen: ConcordanceByBookScreen },
    BibleView: { screen: BibleViewScreen },
    BibleCompareVerses: { screen: BibleCompareVerses },
    Studies: { screen: StudiesScreen },
    Lexique: { screen: LexiqueScreen },
    EditStudy: { screen: EditStudyScreen },
    DictionnaryDetail: { screen: DictionnaryDetailScreen },
    Login: { screen: LoginScreen },
    Support: { screen: SupportScreen },
    ModifyColors: { screen: ModifyColorsScreen },
    Changelog: { screen: ChangelogScreen },
    Pericope: { screen: PericopeScreen },
    History: { screen: HistoryScreen },
    Tags: { screen: TagsScreen },
    Tag: { screen: TagScreen },
    Downloads: { screen: DownloadsScreen },
    Search: { screen: SearchScreen },
    Register: { screen: RegisterScreen },
    Dictionnaire: { screen: DictionnaryScreen },
    FAQ: { screen: FAQScreen },
    Nave: { screen: NaveScreen },
    NaveDetail: { screen: NaveDetailScreen },
    NaveWarning: { screen: NaveWarningScreen },
    ToggleCompareVerses: { screen: ToggleCompareVersesScreen },
    Storybook: { screen: StorybookScreen },
    Plan: { screen: PlanScreen },
    MyPlanList: { screen: MyPlanListScreen },
    PlanSlice: { screen: PlanSliceScreen },
  },
  {
    headerMode: 'none',
  }
)
