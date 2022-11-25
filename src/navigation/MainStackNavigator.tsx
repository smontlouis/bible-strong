import React from 'react'
import { Portal } from 'react-native-paper'
import { createStackNavigator } from 'react-navigation-stack'
import QuotaModal from '~common/QuotaModal'

import Box from '~common/ui/Box'
import BibleCompareVersesScreen from '~features/bible/CompareVersesScreen'
import BibleViewScreen from '~features/bible/BibleScreen'
import BibleSelectScreen from '~features/bible/BibleSelectScreen'
import StrongScreen from '~features/bible/StrongScreen'
import BibleVerseDetailScreen from '~features/bible/BibleVerseDetailScreen'
import BibleVerseNotesScreen from '~features/bible/BibleVerseNotesScreen'
import ConcordanceByBookScreen from '~features/bible/ConcordanceByBookScreen'
import ConcordanceScreen from '~features/bible/ConcordanceScreen'
import HistoryScreen from '~features/bible/HistoryScreen'
import ToggleCompareVersesScreen from '~features/bible/ToggleCompareVersesScreen'
import VersionSelectorScreen from '~features/bible/VersionSelectorScreen'
import CommentariesScreen from '~features/commentaries/CommentariesScreen'
import DictionnaireVerseDetailScreen from '~features/dictionnary/DictionnaireVerseDetailScreen'
import DictionnaryDetailScreen from '~features/dictionnary/DictionnaryDetailScreen'
import DictionnaryScreen from '~features/dictionnary/DictionnaryScreen'
import LexiqueScreen from '~features/lexique/LexiqueScreen'
import NaveDetailScreen from '~features/nave/NaveDetailScreen'
import NaveScreen from '~features/nave/NaveScreen'
import NaveWarningScreen from '~features/nave/NaveWarningScreen'
import MyPlanListScreen from '~features/plans/MyPlanListScreen/MyPlanListScreen'
import PlanScreen from '~features/plans/PlanScreen/PlanScreen'
import PlanSelectScreen from '~features/plans/PlanSelectScreen'
import PlanSliceScreen from '~features/plans/PlanSliceScreen/PlanSliceScreen'
import PremiumScreen from '~features/premium/PremiumScreen'
import LocalSearchScreen from '~features/search/LocalSearchScreen'
import SearchScreen from '~features/search/SearchScreen'
import FAQScreen from '~features/settings/FAQScreen'
import HighlightScreen from '~features/settings/HighlightsScreen'
import LoginScreen from '~features/settings/LoginScreen'
import RegisterScreen from '~features/settings/RegisterScreen'
import SupportScreen from '~features/settings/SupportScreen'
import EditStudyScreen from '~features/studies/EditStudyScreen'
import StudiesScreen from '~features/studies/StudiesScreen'
import TimelineHomeScreen from '~features/timeline/TimelineHomeScreen'
import TimelineScreen from '~features/timeline/TimelineScreen'
import StorybookScreen from '../../storybook/StoryBookScreen'
import PericopeScreen from '../features/bible/PericopeScreen'
import ChangelogScreen from '../features/settings/ChangelogScreen'
import DownloadsScreen from '../features/settings/DownloadsScreen'
import ModifyColorsScreen from '../features/settings/ModifyColorsScreen'
import TagScreen from '../features/settings/TagScreen'
import TagsScreen from '../features/settings/TagsScreen'
import MainTabNavigator from './MainTabNavigator'

export const MainStackNavigator = createStackNavigator(
  {
    MainTab: { screen: MainTabNavigator },
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
    Pericope: { screen: PericopeScreen },
    History: { screen: HistoryScreen },
    Tags: { screen: TagsScreen },
    Tag: { screen: TagScreen },
    Downloads: { screen: DownloadsScreen },
    Search: { screen: SearchScreen },
    LocalSearch: { screen: LocalSearchScreen },
    Register: { screen: RegisterScreen },
    Dictionnaire: { screen: DictionnaryScreen },
    FAQ: { screen: FAQScreen },
    Nave: { screen: NaveScreen },
    NaveDetail: { screen: NaveDetailScreen },
    NaveWarning: { screen: NaveWarningScreen },
    ToggleCompareVerses: { screen: ToggleCompareVersesScreen },
    // Storybook: {
    //   screen: StorybookScreen,
    //   navigationOptions: {
    //     gesturesEnabled: false,
    //   },
    // },
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
    Premium: { screen: PremiumScreen },
    Concordance: { screen: ConcordanceScreen },
    Commentaries: { screen: CommentariesScreen },
  },
  {
    headerMode: 'none',
  }
)

const MainStack = props => (
  <>
    <Portal.Host>
      <MainStackNavigator {...props} />
      <QuotaModal />
    </Portal.Host>
  </>
)

MainStack.router = MainStackNavigator.router

export default MainStack
