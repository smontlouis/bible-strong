import analytics from '@react-native-firebase/analytics'
import * as Sentry from '@sentry/react-native'
import { ThemeProvider } from 'emotion-theming'
import * as Updates from 'expo-updates'
import React, { useEffect } from 'react'
import { TFunction, useTranslation } from 'react-i18next'
import { AppState, AppStateStatus, StatusBar } from 'react-native'
import { Provider as PaperProvider } from 'react-native-paper'
import { MenuProvider } from 'react-native-popup-menu'
import { useDispatch, useSelector } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'

import ConflictModal from '~common/ConflictModal'
import ErrorBoundary from '~common/ErrorBoundary'
import OnBoarding from '~features/onboarding/OnBoarding'

import { NavigationParams, NavigationState } from 'react-navigation'
import { Persistor } from 'redux-persist'
import Changelog from '~common/Changelog'
import SnackBar from '~common/SnackBar'
import { CurrentTheme } from '~common/types'
import { DBStateProvider } from '~helpers/databaseState'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import useInitFireAuth from '~helpers/useInitFireAuth'
import AppNavigator from '~navigation/AppNavigator'
import { RootState } from '~redux/modules/reducer'
import {
  getChangelog,
  getDatabaseUpdate,
  getVersionUpdate,
} from '~redux/modules/user'
import { paperTheme } from '~themes/default'
import getTheme, { Theme } from '~themes/index'
import useLiveUpdates from '~helpers/useLiveUpdates'

interface Props {
  persistor: Persistor
}

const handleAppStateChange = (nextAppState: AppStateStatus) => {
  if (nextAppState.match(/inactive|background/)) {
    console.log('App mode - background!')
  }
}

const getActiveRouteName = (
  navigationState: NavigationState
): {
  route: string
  params: NavigationParams | undefined
} => {
  const route = navigationState.routes[navigationState.index]
  // dive into nested navigators
  if (route.routes) {
    return getActiveRouteName(route)
  }
  return {
    route: route.routeName,
    params: route.params,
  }
}

const onNavigationStateChange = (
  prevState: NavigationState,
  currentState: NavigationState
) => {
  const { route: currentScreen, params: currentParams } = getActiveRouteName(
    currentState
  )
  const { route: prevScreen, params: prevParams } = getActiveRouteName(
    prevState
  )

  if (prevScreen !== currentScreen) {
    if (!__DEV__) {
      analytics().logScreenView({
        screen_class: currentScreen,
        screen_name: currentScreen,
      })
    }

    Sentry.addBreadcrumb({
      category: 'screen',
      message: `From: ${prevScreen} To: ${currentScreen}`,
      data: {
        prevRoute: { prevScreen, prevParams },
        currentRoute: { currentScreen, currentParams },
      },
    })
  }
}

const changeStatusBarStyle = (currentTheme: CurrentTheme) => {
  if (['mauve', 'dark', 'night', 'black'].includes(currentTheme))
    StatusBar.setBarStyle('light-content')
  else StatusBar.setBarStyle('dark-content')
}

const updateApp = async (t: TFunction<'translation'>) => {
  if (__DEV__) return

  const update = await Updates.checkForUpdateAsync()

  if (update.isAvailable) {
    SnackBar.show(t('app.updateAvailable'))
    await Updates.fetchUpdateAsync()
    SnackBar.show(t('app.updateReady'))
    await Updates.reloadAsync()
  }
}

const InitApp = ({ persistor }: Props) => {
  useInitFireAuth()
  useLiveUpdates()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { fontFamily } = useSelector((state: RootState) => ({
    preferredColorScheme: state.user.bible.settings.preferredColorScheme,
    preferredDarkTheme: state.user.bible.settings.preferredDarkTheme,
    preferredLightTheme: state.user.bible.settings.preferredLightTheme,
    fontFamily: state.user.fontFamily,
  }))

  const { theme: currentTheme } = useCurrentThemeSelector()

  useEffect(() => {
    dispatch(getChangelog())
    dispatch(getVersionUpdate())
    dispatch(getDatabaseUpdate())
    changeStatusBarStyle(currentTheme)
    updateApp(t)
    AppState.addEventListener('change', handleAppStateChange)

    return () => {
      AppState.removeEventListener('change', handleAppStateChange)
    }
  }, [currentTheme, dispatch, t])

  const defaultTheme: Theme = getTheme[currentTheme]

  const theme = {
    ...defaultTheme,
    fontFamily: {
      ...defaultTheme.fontFamily,
      paragraph: fontFamily,
    },
  }

  return (
    <ThemeProvider theme={theme}>
      <PaperProvider theme={paperTheme}>
        <MenuProvider
          backHandler
          customStyles={{
            backdrop: {
              backgroundColor: 'black',
              opacity: 0.2,
            },
          }}
        >
          <PersistGate loading={null} persistor={persistor}>
            <DBStateProvider>
              <ErrorBoundary>
                <AppNavigator
                  screenProps={{
                    theme: currentTheme,
                  }}
                  onNavigationStateChange={onNavigationStateChange}
                />
              </ErrorBoundary>
              <Changelog />
              <OnBoarding />
              <ConflictModal />
            </DBStateProvider>
          </PersistGate>
        </MenuProvider>
      </PaperProvider>
    </ThemeProvider>
  )
}

export default InitApp
