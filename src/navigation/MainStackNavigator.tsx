import { PortalProvider } from '@gorhom/portal'
import React from 'react'
import { createStackNavigator } from 'react-navigation-stack'
import ChangelogModal from '~common/Changelog'
import MultipleTagsModal from '~common/MultipleTagsModal'
import AppSwitcherScreen from '~features/app-switcher/AppSwitcherScreen/AppSwitcherScreen'
import BibleViewScreen from '~features/bible/BibleScreen'
import BibleSelectScreen from '~features/bible/BibleSelectScreen'
import BibleVerseDetailScreen from '~features/bible/BibleVerseDetailScreen'
import BibleVerseNotesScreen from '~features/bible/BibleVerseNotesScreen'
import BibleCompareVersesScreen from '~features/bible/CompareVersesScreen'
import ConcordanceByBookScreen from '~features/bible/ConcordanceByBookScreen'
import ConcordanceScreen from '~features/bible/ConcordanceScreen'
import HistoryScreen from '~features/bible/HistoryScreen'
import StrongScreen from '~features/bible/StrongScreen'
import ToggleCompareVersesScreen from '~features/bible/ToggleCompareVersesScreen'
import VersionSelectorScreen from '~features/bible/VersionSelectorScreen'
import CommentariesScreen from '~features/commentaries/CommentariesScreen'
import DictionnaryDetailScreen from '~features/dictionnary/DictionaryDetailScreen'
import DictionaryScreen from '~features/dictionnary/DictionaryScreen'
import DictionnaireVerseDetailScreen from '~features/dictionnary/DictionnaireVerseDetailScreen'
import HomeScreen from '~features/home/HomeScreen'
import LexiqueScreen from '~features/lexique/LexiqueScreen'
import NaveDetailScreen from '~features/nave/NaveDetailScreen'
import NaveScreen from '~features/nave/NaveScreen'
import NaveWarningScreen from '~features/nave/NaveWarningScreen'
import OnBoardingModal from '~features/onboarding/OnBoarding'
import MyPlanListScreen from '~features/plans/MyPlanListScreen/MyPlanListScreen'
import PlanScreen from '~features/plans/PlanScreen/PlanScreen'
import PlanSelectScreen from '~features/plans/PlanSelectScreen'
import PlanSliceScreen from '~features/plans/PlanSliceScreen/PlanSliceScreen'
import LocalSearchScreen from '~features/search/LocalSearchScreen'
import SearchScreen from '~features/search/SearchScreen'
import BibleShareOptionsScreen from '~features/settings/BibleShareOptionsScreen'
import FAQScreen from '~features/settings/FAQScreen'
import HighlightScreen from '~features/settings/HighlightsScreen'
import LoginScreen from '~features/settings/LoginScreen'
import MoreScreen from '~features/settings/MoreScreen'
import RegisterScreen from '~features/settings/RegisterScreen'
import SupportScreen from '~features/settings/SupportScreen'
import EditStudyScreen from '~features/studies/EditStudyScreen'
import StudiesScreen from '~features/studies/StudiesScreen'
import TimelineHomeScreen from '~features/timeline/TimelineHomeScreen'
import TimelineScreen from '~features/timeline/TimelineScreen'
import PericopeScreen from '../features/bible/PericopeScreen'
import ChangelogScreen from '../features/settings/ChangelogScreen'
import ImportExportScreen from '../features/settings/ImportExportScreen'
import DownloadsScreen from '../features/settings/DownloadsScreen'
import ModifyColorsScreen from '../features/settings/ModifyColorsScreen'
import TagScreen from '../features/settings/TagScreen'
import TagsScreen from '../features/settings/TagsScreen'

export const MainStackNavigator = createStackNavigator(
  {
    AppSwitcher: { screen: AppSwitcherScreen },
    More: { screen: MoreScreen },
    Home: { screen: HomeScreen },
    BibleSelect: { screen: BibleSelectScreen },
    VersionSelector: { screen: VersionSelectorScreen },
    BibleVerseDetail: { screen: BibleVerseDetailScreen },
    BibleVerseNotes: { screen: BibleVerseNotesScreen },
    Highlights: { screen: HighlightScreen },
    Strong: { screen: StrongScreen },
    DictionnaireVerseDetail: { screen: DictionnaireVerseDetailScreen },
    ConcordanceByBook: { screen: ConcordanceByBookScreen },
    BibleView: { screen: BibleViewScreen },
    BibleCompareVerses: { screen: BibleCompareVersesScreen },
    Studies: { screen: StudiesScreen },
    Lexique: { screen: LexiqueScreen },
    EditStudy: { screen: EditStudyScreen },
    DictionnaryDetail: { screen: DictionnaryDetailScreen },
    Login: { screen: LoginScreen },
    Support: { screen: SupportScreen },
    ModifyColors: { screen: ModifyColorsScreen },
    Changelog: { screen: ChangelogScreen },
    ImportExport: { screen: ImportExportScreen },
    Pericope: { screen: PericopeScreen },
    History: { screen: HistoryScreen },
    Tags: { screen: TagsScreen },
    Tag: { screen: TagScreen },
    Downloads: { screen: DownloadsScreen },
    Search: { screen: SearchScreen },
    LocalSearch: { screen: LocalSearchScreen },
    Register: { screen: RegisterScreen },
    Dictionnaire: { screen: DictionaryScreen },
    FAQ: { screen: FAQScreen },
    Nave: { screen: NaveScreen },
    NaveDetail: { screen: NaveDetailScreen },
    NaveWarning: { screen: NaveWarningScreen },
    ToggleCompareVerses: { screen: ToggleCompareVersesScreen },
    Plan: { screen: PlanScreen },
    Plans: { screen: PlanSelectScreen },
    MyPlanList: { screen: MyPlanListScreen },
    PlanSlice: { screen: PlanSliceScreen },
    Timeline: {
      screen: TimelineScreen,
      navigationOptions: {
        gesturesEnabled: false,
      },
    },
    TimelineHome: { screen: TimelineHomeScreen },
    Concordance: { screen: ConcordanceScreen },
    Commentaries: { screen: CommentariesScreen },
    BibleShareOptions: { screen: BibleShareOptionsScreen },
  },
  {
    headerMode: 'none',
    initialRouteName: 'AppSwitcher',
  }
)

const MainStack = props => (
  <PortalProvider>
    <MainStackNavigator {...props} />
    <ChangelogModal />
    <OnBoardingModal />
    <MultipleTagsModal />
  </PortalProvider>
)

MainStack.router = MainStackNavigator.router

export default MainStack
