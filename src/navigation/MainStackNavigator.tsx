import { PortalProvider } from '@gorhom/portal'
import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
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

export const MainStackNavigator = createStackNavigator()

const MainStack = props => (
  <PortalProvider>
    <MainStackNavigator.Navigator initialRouteName='AppSwitcher' screenOptions={{ headerShown: false }}>
      <MainStackNavigator.Screen name='AppSwitcher' component={AppSwitcherScreen} {...props} />
      <MainStackNavigator.Screen name='More' component={MoreScreen} {...props} />
      <MainStackNavigator.Screen name='Home' component={HomeScreen} {...props} />
      <MainStackNavigator.Screen name='BibleSelect' component={BibleSelectScreen} {...props} />
      <MainStackNavigator.Screen name='VersionSelector' component={VersionSelectorScreen} {...props} />
      <MainStackNavigator.Screen name='BibleVerseDetail' component={BibleVerseDetailScreen} {...props} />
      <MainStackNavigator.Screen name='BibleVerseNotes' component={BibleVerseNotesScreen} {...props} />
      <MainStackNavigator.Screen name='Highlights' component={HighlightScreen} {...props} />
      <MainStackNavigator.Screen name='Strong' component={StrongScreen} {...props} />
      <MainStackNavigator.Screen name='DictionnaireVerseDetail' component={DictionnaireVerseDetailScreen} {...props} />
      <MainStackNavigator.Screen name='ConcordanceByBook' component={ConcordanceByBookScreen} {...props} />
      <MainStackNavigator.Screen name='BibleView' component={BibleViewScreen} {...props} />
      <MainStackNavigator.Screen name='BibleCompareVerses' component={BibleCompareVersesScreen} {...props} />
      <MainStackNavigator.Screen name='Studies' component={StudiesScreen} {...props} />
      <MainStackNavigator.Screen name='Lexique' component={LexiqueScreen} {...props} />
      <MainStackNavigator.Screen name='EditStudy' component={EditStudyScreen} {...props} />
      <MainStackNavigator.Screen name='DictionnaryDetail' component={DictionnaryDetailScreen} {...props} />
      <MainStackNavigator.Screen name='Login' component={LoginScreen} {...props} />
      <MainStackNavigator.Screen name='Support' component={SupportScreen} {...props} />
      <MainStackNavigator.Screen name='ModifyColors' component={ModifyColorsScreen} {...props} />
      <MainStackNavigator.Screen name='Changelog' component={ChangelogScreen} {...props} />
      <MainStackNavigator.Screen name='ImportExport' component={ImportExportScreen} {...props} />
      <MainStackNavigator.Screen name='Pericope' component={PericopeScreen} {...props} />
      <MainStackNavigator.Screen name='History' component={HistoryScreen} {...props} />
      <MainStackNavigator.Screen name='Tags' component={TagsScreen} {...props} />
      <MainStackNavigator.Screen name='Tag' component={TagScreen} {...props} />
      <MainStackNavigator.Screen name='Downloads' component={DownloadsScreen} {...props} />
      <MainStackNavigator.Screen name='Search' component={SearchScreen} {...props} />
      <MainStackNavigator.Screen name='LocalSearch' component={LocalSearchScreen} {...props} />
      <MainStackNavigator.Screen name='Register' component={RegisterScreen} {...props} />
      <MainStackNavigator.Screen name='Dictionnaire' component={DictionaryScreen} {...props} />
      <MainStackNavigator.Screen name='FAQ' component={FAQScreen} {...props} />
      <MainStackNavigator.Screen name='Nave' component={NaveScreen} {...props} />
      <MainStackNavigator.Screen name='NaveDetail' component={NaveDetailScreen} {...props} />
      <MainStackNavigator.Screen name='NaveWarning' component={NaveWarningScreen} {...props} />
      <MainStackNavigator.Screen name='ToggleCompareVerses' component={ToggleCompareVersesScreen} {...props} />
      <MainStackNavigator.Screen name='Plan' component={PlanScreen} {...props} />
      <MainStackNavigator.Screen name='Plans' component={PlanSelectScreen} {...props} />
      <MainStackNavigator.Screen name='MyPlanList' component={MyPlanListScreen} {...props} />
      <MainStackNavigator.Screen name='PlanSlice' component={PlanSliceScreen} {...props} />
      <MainStackNavigator.Screen name='Timeline' component={TimelineScreen} options={{ gestureEnabled: true }} {...props} />
      <MainStackNavigator.Screen name='TimelineHome' component={TimelineHomeScreen} {...props} />
      <MainStackNavigator.Screen name='Concordance' component={ConcordanceScreen} {...props} />
      <MainStackNavigator.Screen name='Commentaries' component={CommentariesScreen} {...props} />
      <MainStackNavigator.Screen name='BibleShareOptions' component={BibleShareOptionsScreen} {...props} />
    </MainStackNavigator.Navigator>
    
    <ChangelogModal />
    <OnBoardingModal />
    <MultipleTagsModal />

  </PortalProvider>
)

export default MainStack;
