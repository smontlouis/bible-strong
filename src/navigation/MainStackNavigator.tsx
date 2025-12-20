import { createStackNavigator } from '@react-navigation/stack'

import { MainStackProps } from '~navigation/type'

import ChangelogModal from '~common/Changelog'
import MultipleTagsModal from '~common/MultipleTagsModal'

import AppSwitcherScreen from '~features/app-switcher/AppSwitcherScreen/AppSwitcherScreen'
import BibleViewScreen from '~features/bible/BibleScreen'
import BibleVerseNotesScreen from '~features/bible/BibleVerseNotesScreen'
import { BookSelectorBottomSheetProvider } from '~features/bible/BookSelectorBottomSheet/BookSelectorBottomSheetProvider'
import BibleCompareVersesScreen from '~features/bible/CompareVersesScreen'
import ConcordanceByBookScreen from '~features/bible/ConcordanceByBookScreen'
import ConcordanceScreen from '~features/bible/ConcordanceScreen'
import HistoryScreen from '~features/bible/HistoryScreen'
import StrongScreen from '~features/bible/StrongScreen'
import ToggleCompareVersesScreen from '~features/bible/ToggleCompareVersesScreen'
import CommentariesScreen from '~features/commentaries/CommentariesScreen'
import DictionnaryDetailScreen from '~features/dictionnary/DictionaryDetailScreen'
import DictionaryScreen from '~features/dictionnary/DictionaryScreen'
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
import DownloadsScreen from '../features/settings/DownloadsScreen'
import ImportExportScreen from '../features/settings/ImportExportScreen'
import CustomHighlightColorsScreen from '../features/settings/CustomHighlightColorsScreen'
import ResourceLanguageScreen from '../features/settings/ResourceLanguageScreen'
import TagScreen from '../features/settings/TagScreen'
import TagsScreen from '../features/settings/TagsScreen'
import BookmarksScreen from '~features/bookmarks/BookmarksScreen'
import { PortalProvider } from '@gorhom/portal'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'

export const MainStackNavigator = createStackNavigator<MainStackProps>()

const MainStack = () => {
  return (
    <PortalProvider>
      <BottomSheetModalProvider>
        <BookSelectorBottomSheetProvider>
          <MainStackNavigator.Navigator
            initialRouteName="AppSwitcher"
            screenOptions={{ headerShown: false }}
          >
            <MainStackNavigator.Screen name="AppSwitcher" component={AppSwitcherScreen} />
            <MainStackNavigator.Screen name="More" component={MoreScreen} />
            <MainStackNavigator.Screen name="Home" component={HomeScreen} />

            <MainStackNavigator.Screen name="BibleVerseNotes" component={BibleVerseNotesScreen} />
            <MainStackNavigator.Screen name="Highlights" component={HighlightScreen} />
            <MainStackNavigator.Screen name="Strong" component={StrongScreen} />
            <MainStackNavigator.Screen
              name="ConcordanceByBook"
              component={ConcordanceByBookScreen}
            />
            <MainStackNavigator.Screen name="BibleView" component={BibleViewScreen} />
            <MainStackNavigator.Screen
              name="BibleCompareVerses"
              component={BibleCompareVersesScreen}
            />
            <MainStackNavigator.Screen name="Studies" component={StudiesScreen} />
            <MainStackNavigator.Screen name="Lexique" component={LexiqueScreen} />
            <MainStackNavigator.Screen name="EditStudy" component={EditStudyScreen} />
            <MainStackNavigator.Screen
              name="DictionnaryDetail"
              component={DictionnaryDetailScreen}
            />
            <MainStackNavigator.Screen name="Login" component={LoginScreen} />
            <MainStackNavigator.Screen name="Support" component={SupportScreen} />
            <MainStackNavigator.Screen name="CustomHighlightColors" component={CustomHighlightColorsScreen} />
            <MainStackNavigator.Screen name="Changelog" component={ChangelogScreen} />
            <MainStackNavigator.Screen name="ImportExport" component={ImportExportScreen} />
            <MainStackNavigator.Screen name="Pericope" component={PericopeScreen} />
            <MainStackNavigator.Screen name="History" component={HistoryScreen} />
            <MainStackNavigator.Screen name="Tags" component={TagsScreen} />
            <MainStackNavigator.Screen name="Bookmarks" component={BookmarksScreen} />
            <MainStackNavigator.Screen name="Tag" component={TagScreen} />
            <MainStackNavigator.Screen name="Downloads" component={DownloadsScreen} />
            <MainStackNavigator.Screen name="Search" component={SearchScreen} />
            <MainStackNavigator.Screen name="LocalSearch" component={LocalSearchScreen} />
            <MainStackNavigator.Screen name="Register" component={RegisterScreen} />
            <MainStackNavigator.Screen name="Dictionnaire" component={DictionaryScreen} />
            <MainStackNavigator.Screen name="FAQ" component={FAQScreen} />
            <MainStackNavigator.Screen name="Nave" component={NaveScreen} />
            <MainStackNavigator.Screen name="NaveDetail" component={NaveDetailScreen} />
            <MainStackNavigator.Screen name="NaveWarning" component={NaveWarningScreen} />
            <MainStackNavigator.Screen
              name="ToggleCompareVerses"
              component={ToggleCompareVersesScreen}
            />
            <MainStackNavigator.Screen name="Plan" component={PlanScreen} />
            <MainStackNavigator.Screen name="Plans" component={PlanSelectScreen} />
            <MainStackNavigator.Screen name="MyPlanList" component={MyPlanListScreen} />
            <MainStackNavigator.Screen name="PlanSlice" component={PlanSliceScreen} />
            <MainStackNavigator.Screen
              name="Timeline"
              component={TimelineScreen}
              options={{ gestureEnabled: true }}
            />
            <MainStackNavigator.Screen name="TimelineHome" component={TimelineHomeScreen} />
            <MainStackNavigator.Screen name="Concordance" component={ConcordanceScreen} />
            <MainStackNavigator.Screen name="Commentaries" component={CommentariesScreen} />
            <MainStackNavigator.Screen
              name="BibleShareOptions"
              component={BibleShareOptionsScreen}
            />
            <MainStackNavigator.Screen name="ResourceLanguage" component={ResourceLanguageScreen} />
          </MainStackNavigator.Navigator>

          <ChangelogModal />
          <OnBoardingModal />
          <MultipleTagsModal />
        </BookSelectorBottomSheetProvider>
      </BottomSheetModalProvider>
    </PortalProvider>
  )
}

export default MainStack
