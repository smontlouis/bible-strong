import React from 'react'
import { getAnalytics, logScreenView } from '@react-native-firebase/analytics'
import * as Sentry from '@sentry/react-native'
import { useTheme } from '@emotion/react'
import {
  NavigationContainer,
  useNavigationContainerRef,
  Route,
  NavigationContainerRefWithCurrent,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native'
import MainStackNavigator from './MainStackNavigator'

// Helper types for navigation ref and route ref
type NavigationRef = NavigationContainerRefWithCurrent<ReactNavigation.RootParamList>
type RouteRef = React.MutableRefObject<Route<string> | undefined>

const setCurrentRoute = (navigationRef: NavigationRef, routeRef: RouteRef) => {
  const current_route = navigationRef.getCurrentRoute()
  if (current_route == undefined) return

  routeRef.current = current_route
}

const onNavigationStateChange = (navigationRef: NavigationRef, routeRef: RouteRef) => {
  const currentRoute = navigationRef.getCurrentRoute()

  if (routeRef.current == undefined) return

  if (currentRoute == undefined) return

  const { name: prevScreen, params: prevParams } = routeRef.current
  const { name: currentScreen, params: currentParams } = currentRoute

  if (prevScreen != currentScreen) {
    if (!__DEV__) {
      logScreenView(getAnalytics(), {
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

function AppNavigator() {
  const navigationRef = useNavigationContainerRef()
  const routeNameRef = React.useRef<Route<string>>()
  const theme = useTheme()

  const navigationTheme = {
    ...(theme.colorScheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.colorScheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.colors.lightGrey,
      card: theme.colors.reverse,
    },
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => setCurrentRoute(navigationRef, routeNameRef)}
      onStateChange={() => onNavigationStateChange(navigationRef, routeNameRef)}
    >
      <MainStackNavigator />
    </NavigationContainer>
  )
}

export default AppNavigator
