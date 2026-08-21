// installReduxDevToolsPolyfill()

import { ThemeProvider } from '@emotion/react'
import * as Sentry from '@sentry/react-native'

import * as SplashScreen from 'expo-splash-screen'
import * as Font from 'expo-font'
import * as Icon from '@expo/vector-icons'
import { setAutoFreeze } from 'immer'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, LogBox, Pressable, Text as NativeText, View } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { configureReanimatedLogger } from 'react-native-reanimated'
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context'
import { Provider as ReduxProvider, useSelector } from 'react-redux'

import { PersistGate } from 'redux-persist/integration/react'
import ErrorBoundary from '~common/ErrorBoundary'
import { CurrentTheme } from '~common/types'
import { ResourceAccessProvider } from '~features/resources/resourceAccess'
import { appLogger } from '~helpers/agentObservability'
import { ignoreSentryErrors } from '~helpers/ignoreSentryErrors'
import { QueryClientProvider } from '@tanstack/react-query'
import { configureQueryManagers, queryClient } from '~helpers/queryClient'
import { initializeResourceAppCheck } from '~helpers/resourceAppCheck'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { useRemoteConfig } from '~helpers/useRemoteConfig'
import { RootState } from '~redux/modules/reducer'
import { persistor, startPersistence, store } from '~redux/store'
import { applyPreferredColorScheme } from '~redux/themeAppearanceMiddleware'
import getTheme, { baseTheme, Theme } from '~themes/index'
import { isPlaygroundEnabled } from '~helpers/runtimeConfig'
import i18n, { setI18n } from '../i18n'

const loadFullAppRuntime = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('~features/app/FullAppRuntime').default
}

const FullAppRuntime = isPlaygroundEnabled
  ? lazy(() => import('~features/app/FullAppRuntime'))
  : loadFullAppRuntime()
const PlaygroundScreen = lazy(() => import('~features/playground/PlaygroundScreen'))

if (!isPlaygroundEnabled) {
  // Keep this registration synchronous in normal mode so a background
  // notification never depends on the React tree finishing its startup.
  const { default: notifee, EventType } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@notifee/react-native') as typeof import('@notifee/react-native')
  notifee.onBackgroundEvent(async ({ type }) => {
    if (type === EventType.PRESS || type === EventType.DISMISSED) return
  })
}

// Configure Reanimated logger
configureReanimatedLogger({
  strict: false,
})

// Prevent native splash screen from autohiding
SplashScreen.preventAutoHideAsync()
  .then(result => {
    appLogger.info('startup', 'splash.prevent_auto_hide.succeeded', { result })
    console.log(`SplashScreen.preventAutoHideAsync() succeeded: ${result}`)
  })
  .catch(error => {
    appLogger.warn('startup', 'splash.prevent_auto_hide.failed', { error })
    console.warn(error)
  })

SplashScreen.setOptions({
  duration: 300,
  fade: true,
})

setAutoFreeze(false)
LogBox.ignoreLogs(['Require cycle', 'EventEmitter.removeListener'])

let sentryInitialized = false
const initSentry = () => {
  if (sentryInitialized) return
  sentryInitialized = true
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    // Error events are low-volume and operationally critical. Do not sample them,
    // especially during startup where a single failed migration can block the app.
    sampleRate: 1,
    sendDefaultPii: false,
    maxBreadcrumbs: 100,
    ignoreErrors: ignoreSentryErrors,
  })
  appLogger.info('startup', 'sentry.init')
}

if (!isPlaygroundEnabled) initSentry()

configureQueryManagers()

const StartupLoading = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator />
  </View>
)

const preparePlaygroundFonts = async () => {
  try {
    await Font.loadAsync({
      ...Icon.Feather.font,
      'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
      'eina-03-bold': require('~assets/fonts/eina-03-bold.otf'),
    })
  } catch (error) {
    appLogger.warn('startup', 'playground.fonts.failed', { error })
  }
}

// Hook to load app resources
const useAppLoad = () => {
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false)
  const [loadError, setLoadError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    ;(async () => {
      let preparationStep = 'resource_app_check'
      try {
        setLoadError(undefined)
        if (!isPlaygroundEnabled) {
          // RNFirebase requires App Check to be initialized before any Firebase
          // backend service. Starting it before the first await also keeps the
          // migration gate from becoming the first code path that configures it.
          await initializeResourceAppCheck()
          appLogger.info('startup', 'resource_app_check.initialized')
        }
        preparationStep = 'i18n'
        appLogger.info('startup', 'i18n.init.started')
        await setI18n()
        appLogger.info('startup', 'i18n.init.completed')
        if (!isPlaygroundEnabled) {
          preparationStep = 'local_migration'
          const { prepareLocalMigrationStartup } =
            await import('../src/migrations/localMigrationRegistry')
          await prepareLocalMigrationStartup()
        } else {
          preparationStep = 'playground_fonts'
          await preparePlaygroundFonts()
          appLogger.info('startup', 'playground.mode_enabled')
        }
        preparationStep = 'redux_persistence'
        startPersistence()
        if (!active) return
        setIsLoadingCompleted(true)
        if (!isPlaygroundEnabled && !__DEV__) {
          const { getAnalytics, logScreenView } = await import('@react-native-firebase/analytics')
          logScreenView(getAnalytics(), {
            screen_class: 'Bible',
            screen_name: 'Bible',
          })
        }
      } catch (error) {
        appLogger.captureError('startup', 'app.preparation.failed', error, { preparationStep })
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'STARTUP_PREPARATION_FAILED')
        }
      }
    })()
    return () => {
      active = false
    }
  }, [attempt])

  useRemoteConfig(!isPlaygroundEnabled)

  return {
    isLoadingCompleted,
    loadError,
    retry: () => setAttempt(value => value + 1),
  }
}

// Status bar style changer
const changeStatusBarStyle = (currentTheme: CurrentTheme) => {
  if (['mauve', 'dark', 'night', 'black'].includes(currentTheme)) {
    return SystemBars.pushStackEntry({ style: 'light' })
  }

  return SystemBars.pushStackEntry({ style: 'dark' })
}

// Inner app with all providers (needs Redux context)
function InnerApp() {
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const preferredColorScheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredColorScheme || 'auto'
  )
  const { theme: selectedTheme } = useCurrentThemeSelector()
  const currentTheme = isPlaygroundEnabled ? 'default' : selectedTheme

  useEffect(() => {
    const entry = changeStatusBarStyle(currentTheme)
    return () => SystemBars.popStackEntry(entry)
  }, [currentTheme])

  useEffect(() => {
    if (isPlaygroundEnabled || preferredColorScheme === 'auto') return

    applyPreferredColorScheme(preferredColorScheme)
  }, [preferredColorScheme])

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

  const appContent = isPlaygroundEnabled ? (
    <Suspense fallback={<StartupLoading />}>
      <PlaygroundScreen />
    </Suspense>
  ) : (
    <Suspense fallback={<StartupLoading />}>
      <FullAppRuntime theme={theme} />
    </Suspense>
  )

  return (
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <PersistGate loading={<StartupLoading />} persistor={persistor}>
          <ErrorBoundary>
            <ResourceAccessProvider>{appContent}</ResourceAccessProvider>
          </ErrorBoundary>
        </PersistGate>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

// Root layout component
function RootLayout() {
  const { isLoadingCompleted, loadError, retry } = useAppLoad()

  const onLayoutRootView = useCallback(() => {
    if (isLoadingCompleted) {
      appLogger.info('startup', 'root.layout.ready')
      SplashScreen.hide()
    }
  }, [isLoadingCompleted])

  const onLayoutLoadError = () => {
    appLogger.warn('startup', 'root.layout.load_error_ready', { error: loadError })
    SplashScreen.hide()
  }

  if (!isLoadingCompleted) {
    if (loadError) {
      return (
        <View
          onLayout={onLayoutLoadError}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}
        >
          <NativeText style={{ fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
            {i18n.t('migration.checkFailedTitle')}
          </NativeText>
          <NativeText style={{ marginTop: 12, opacity: 0.7, textAlign: 'center' }}>
            {i18n.t('migration.checkFailedDescription')}
          </NativeText>
          <NativeText style={{ marginTop: 8, opacity: 0.6, fontSize: 12 }}>{loadError}</NativeText>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={{ marginTop: 24, paddingHorizontal: 28, paddingVertical: 14 }}
          >
            <NativeText style={{ fontSize: 16, fontWeight: '700' }}>
              {i18n.t('migration.retry')}
            </NativeText>
          </Pressable>
        </View>
      )
    }
    return <StartupLoading />
  }

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <KeyboardProvider>
            <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
              <ReduxProvider store={store}>
                <InnerApp />
              </ReduxProvider>
            </View>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  )
}

if (!isPlaygroundEnabled) initSentry()

export default Sentry.wrap(RootLayout)
