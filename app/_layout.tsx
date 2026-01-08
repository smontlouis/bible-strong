import { installReduxDevToolsPolyfill } from '~devtools/reduxDevtoolsPolyfill'
// installReduxDevToolsPolyfill()

import { ThemeProvider } from '@emotion/react'
import * as Icon from '@expo/vector-icons'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { PortalProvider } from '@gorhom/portal'
import { getAnalytics, logScreenView } from '@react-native-firebase/analytics'
import * as Sentry from '@sentry/react-native'
import * as Font from 'expo-font'
import { Stack, useLocalSearchParams, usePathname, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { setAutoFreeze } from 'immer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, LogBox, Text, View } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { MenuProvider } from 'react-native-popup-menu'
import { configureReanimatedLogger } from 'react-native-reanimated'
import { RootSiblingParent } from 'react-native-root-siblings'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Provider as ReduxProvider, useSelector } from 'react-redux'
import { Toaster } from 'sonner-native'

import notifee, { EventType } from '@notifee/react-native'
import { useKeepAwake } from 'expo-keep-awake'
import { useAtomsDevtools } from 'jotai-devtools/utils'
import TrackPlayer from 'react-native-track-player'
import { PersistGate } from 'redux-persist/integration/react'
import ChangelogModal from '~common/Changelog'
import ErrorBoundary from '~common/ErrorBoundary'
import InitHooks from '~common/InitHooks'
import MultipleTagsModal from '~common/MultipleTagsModal'
import { CurrentTheme } from '~common/types'
import { AppSwitcherProvider } from '~features/app-switcher/AppSwitcherProvider'
import { BookSelectorBottomSheetProvider } from '~features/bible/BookSelectorBottomSheet/BookSelectorBottomSheetProvider'
import OnBoardingModal from '~features/onboarding/OnBoarding'
import { DBStateProvider } from '~helpers/databaseState'
import { ignoreSentryErrors } from '~helpers/ignoreSentryErrors'
import { QueryClient, QueryClientProvider } from '~helpers/react-query-lite'
import { checkDatabasesStorage } from '~helpers/sqlite'
import {
  useMigrateFromAsyncStorage,
  useMigrateFromFileSystemStorage,
  useMigrateToLanguageFolders,
} from '~helpers/storage'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { useRemoteConfig } from '~helpers/useRemoteConfig'
import { useUpdates } from '~helpers/useUpdates'
import { RootState } from '~redux/modules/reducer'
import { persistor, store } from '~redux/store'
import getTheme, { Theme, baseTheme } from '~themes/index'
import { setI18n } from '../i18n'
import { PlaybackService } from '../playbackService'

TrackPlayer.registerPlaybackService(() => PlaybackService)

// Register background event handler for Notifee
// This prevents ANR when notifications fire while app is in background
// by handling events without spinning up the full React Native context
notifee.onBackgroundEvent(async ({ type, detail }) => {
  // Handle notification press in background
  if (type === EventType.PRESS) {
    // Notification was pressed - app will open and handle in foreground
    return
  }

  // Handle notification dismissed
  if (type === EventType.DISMISSED) {
    return
  }

  // For trigger notifications (like Verse of the Day), just acknowledge
  // The notification has already been displayed by the system
  return
})

// Configure Reanimated logger
configureReanimatedLogger({
  strict: false,
})

// Prevent native splash screen from autohiding
SplashScreen.preventAutoHideAsync()
  .then(result => console.log(`SplashScreen.preventAutoHideAsync() succeeded: ${result}`))
  .catch(console.warn)

SplashScreen.setOptions({
  duration: 1000,
  fade: true,
})

setAutoFreeze(false)
LogBox.ignoreLogs(['Require cycle', 'EventEmitter.removeListener'])

// Initialize Sentry
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sampleRate: 0.5,
  ignoreErrors: ignoreSentryErrors,
})

const queryClient = new QueryClient()

const loadResourcesAsync = async () => {
  return Promise.all([
    Font.loadAsync({
      ...Icon.Feather.font,
      ...Icon.Ionicons.font,
      'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
      'eina-03-bold': require('~assets/fonts/eina-03-bold.otf'),
    }),
  ])
}

// Hook to load app resources
const useAppLoad = () => {
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false)
  const hasMigratedFromAsyncStorage = useMigrateFromAsyncStorage()
  const hasMigratedFromFileSystem = useMigrateFromFileSystemStorage()
  const hasMigratedToLanguageFolders = useMigrateToLanguageFolders()
  const [status, setStatus] = useState('')

  useEffect(() => {
    ;(async () => {
      setStatus('Load resources')
      await loadResourcesAsync()
      setStatus('Set i18n')
      await setI18n()
      await checkDatabasesStorage()
      setIsLoadingCompleted(true)
      if (!__DEV__) {
        logScreenView(getAnalytics(), {
          screen_class: 'Bible',
          screen_name: 'Bible',
        })
      }
    })()
  }, [])

  useRemoteConfig()

  const isCompleted =
    isLoadingCompleted &&
    hasMigratedFromAsyncStorage &&
    hasMigratedFromFileSystem &&
    hasMigratedToLanguageFolders

  return {
    isLoadingCompleted: isCompleted,
    status,
  }
}

// Status bar style changer
const changeStatusBarStyle = (currentTheme: CurrentTheme) => {
  if (['mauve', 'dark', 'night', 'black'].includes(currentTheme)) {
    SystemBars.pushStackEntry({ style: 'light' })
  } else {
    SystemBars.pushStackEntry({ style: 'dark' })
  }
}

// Analytics tracking for navigation
const useNavigationTracking = () => {
  const pathname = usePathname()
  const segments = useSegments()
  const params = useLocalSearchParams()
  const prevPathnameRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      const screenName = segments[segments.length - 1] || 'index'

      if (__DEV__) {
        console.log('[Navigation]', {
          pathname,
          segments,
          params: Object.keys(params).length > 0 ? params : undefined,
        })
      } else {
        logScreenView(getAnalytics(), {
          screen_class: screenName,
          screen_name: screenName,
        })
      }

      Sentry.addBreadcrumb({
        category: 'screen',
        message: `Navigated to: ${pathname}`,
        data: { pathname, segments },
      })

      prevPathnameRef.current = pathname
    }
  }, [pathname, segments, params])
}

// Inner app with all providers (needs Redux context)
function InnerApp() {
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const { theme: currentTheme, colorScheme } = useCurrentThemeSelector()

  useKeepAwake()
  useUpdates()
  useNavigationTracking()
  useAtomsDevtools('jotai')

  useEffect(() => {
    changeStatusBarStyle(currentTheme)
  }, [currentTheme])

  const theme = useMemo(() => {
    const defaultTheme: Theme = getTheme[currentTheme] || baseTheme
    return {
      ...defaultTheme,
      fontFamily: {
        ...defaultTheme.fontFamily,
        paragraph: fontFamily,
      },
    }
  }, [currentTheme, fontFamily])

  return (
    <ThemeProvider theme={theme}>
      <MenuProvider
        backHandler
        customStyles={{
          backdrop: {
            backgroundColor: 'black',
            opacity: 0.2,
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <PersistGate
            loading={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator />
              </View>
            }
            persistor={persistor}
          >
            <DBStateProvider>
              <ErrorBoundary>
                <AppSwitcherProvider>
                  <RootSiblingParent>
                    <PortalProvider>
                      <BottomSheetModalProvider>
                        <BookSelectorBottomSheetProvider>
                          <InitHooks />
                          <Stack screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="index" />
                          </Stack>
                          <Toaster
                            duration={3000}
                            theme={colorScheme}
                            position="top-center"
                            icons={{ info: <></> }}
                          />
                          <ChangelogModal />
                          <OnBoardingModal />
                          <MultipleTagsModal />
                        </BookSelectorBottomSheetProvider>
                      </BottomSheetModalProvider>
                    </PortalProvider>
                  </RootSiblingParent>
                </AppSwitcherProvider>
              </ErrorBoundary>
            </DBStateProvider>
          </PersistGate>
        </QueryClientProvider>
      </MenuProvider>
    </ThemeProvider>
  )
}

// Root layout component
function RootLayout() {
  const { isLoadingCompleted, status } = useAppLoad()

  const onLayoutRootView = useCallback(() => {
    if (isLoadingCompleted) {
      SplashScreen.hide()
    }
  }, [isLoadingCompleted])

  if (!isLoadingCompleted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text>{status}</Text>
      </View>
    )
  }

  return (
    <>
      <SystemBars style="light" />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
            <ReduxProvider store={store}>
              <InnerApp />
            </ReduxProvider>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  )
}

export default Sentry.wrap(RootLayout)
