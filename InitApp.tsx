import { ThemeProvider } from '@emotion/react'
import analytics from '@react-native-firebase/analytics'
import * as Sentry from '@sentry/react-native'
import * as Updates from 'expo-updates'
import React, { memo, useEffect, useMemo } from 'react'
import { TFunction, useTranslation } from 'react-i18next'
import { AppState, AppStateStatus, StatusBar } from 'react-native'
import { Provider as PaperProvider } from 'react-native-paper'
import { MenuProvider } from 'react-native-popup-menu'
import { useDispatch, useSelector } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ErrorBoundary from '~common/ErrorBoundary'

import { NavigationParams, NavigationState } from 'react-navigation'
import { Persistor } from 'redux-persist'
import SnackBar from '~common/SnackBar'
import { CurrentTheme } from '~common/types'
import { AppSwitcherProvider } from '~features/app-switcher/AppSwitcherProvider'
import { DBStateProvider } from '~helpers/databaseState'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import useInitFireAuth from '~helpers/useInitFireAuth'
import useLiveUpdates from '~helpers/useLiveUpdates'
import AppNavigator from '~navigation/AppNavigator'
import { RootState } from '~redux/modules/reducer'
import {
  getChangelog,
  getDatabaseUpdate,
  getVersionUpdate,
} from '~redux/modules/user'
import { paperTheme } from '~themes/default'
import getTheme, { baseTheme, Theme } from '~themes/index'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

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

const queryClient = new QueryClient()

const InitApp = ({ persistor }: Props) => {
  useInitFireAuth()
  useLiveUpdates()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const { theme: currentTheme } = useCurrentThemeSelector()

  useEffect(() => {
    dispatch(getChangelog())
    dispatch(getVersionUpdate())
    dispatch(getDatabaseUpdate())
    updateApp(t)
    AppState.addEventListener('change', handleAppStateChange)

    return () => {
      AppState.removeEventListener('change', handleAppStateChange)
    }
  }, [dispatch, t])

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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
            <QueryClientProvider client={queryClient}>
              <PersistGate loading={null} persistor={persistor}>
                <DBStateProvider>
                  <ErrorBoundary>
                    <AppSwitcherProvider>
                      <AppNavigator
                        onNavigationStateChange={onNavigationStateChange}
                      />
                    </AppSwitcherProvider>
                  </ErrorBoundary>
                </DBStateProvider>
              </PersistGate>
            </QueryClientProvider>
          </MenuProvider>
        </PaperProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}

export default memo(InitApp)
