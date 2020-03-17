import React from 'react'
import { ThemeProvider } from 'emotion-theming'
import { Provider as PaperProvider } from 'react-native-paper'
import { StatusBar, AppState } from 'react-native'
import { PersistGate } from 'redux-persist/integration/react'
import { connect } from 'react-redux'
import * as Sentry from '@sentry/react-native'
import compose from 'recompose/compose'
import analytics from '@react-native-firebase/analytics'
import { MenuProvider } from 'react-native-popup-menu'

import ErrorBoundary from '~common/ErrorBoundary'

import {
  updateUserData,
  getChangelog,
  getVersionUpdate,
  getDatabaseUpdate
} from '~redux/modules/user'
import withFireAuth from '~common/withFireAuth'
import AppNavigator from '~navigation/AppNavigator'
import Changelog from '~common/Changelog'
import getTheme from '~themes'
import { paperTheme } from '~themes/default'
import { DBStateProvider } from '~helpers/databaseState'

import * as test from '~redux/modules/user'

class InitApp extends React.Component {
  componentDidMount() {
    console.log(test)
    this.props.dispatch(getChangelog())
    this.props.dispatch(getVersionUpdate())
    this.props.dispatch(getDatabaseUpdate())
    this.changeStatusBarStyle()
    AppState.addEventListener('change', this.handleAppStateChange)
  }

  componentWillUnmount() {
    AppState.removeEventListener('change', this.handleAppStateChange)
  }

  handleAppStateChange = nextAppState => {
    if (nextAppState.match(/inactive|background/)) {
      console.log('App mode - background!')
      this.props.dispatch(updateUserData())
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.theme !== this.props.theme) {
      this.changeStatusBarStyle()
    }
  }

  changeStatusBarStyle = () => {
    if (this.props.theme === 'dark') StatusBar.setBarStyle('light-content')
    else StatusBar.setBarStyle('dark-content')
  }

  getActiveRouteName = navigationState => {
    if (!navigationState) {
      return null
    }
    const route = navigationState.routes[navigationState.index]
    // dive into nested navigators
    if (route.routes) {
      return this.getActiveRouteName(route)
    }
    return {
      route: route.routeName,
      params: route.params
    }
  }

  onNavigationStateChange = (prevState, currentState) => {
    const {
      route: currentScreen,
      params: currentParams
    } = this.getActiveRouteName(currentState)
    const { route: prevScreen, params: prevParams } = this.getActiveRouteName(
      prevState
    )

    if (prevScreen !== currentScreen) {
      if (!__DEV__) {
        analytics().setCurrentScreen(currentScreen, currentScreen)
      }

      Sentry.addBreadcrumb({
        category: 'screen',
        message: `From: ${prevScreen} To: ${currentScreen}`,
        data: {
          prevRoute: { prevScreen, prevParams },
          currentRoute: { currentScreen, currentParams }
        }
      })
    }
  }

  render() {
    const { theme: currentTheme, fontFamily, persistor } = this.props

    const defaultTheme = getTheme[currentTheme]

    const theme = {
      ...defaultTheme,
      fontFamily: {
        ...defaultTheme.fontFamily,
        paragraph: fontFamily
      }
    }

    return (
      <ThemeProvider theme={theme}>
        <PaperProvider theme={paperTheme}>
          <MenuProvider
            backHandler
            customStyles={{
              backdrop: {
                backgroundColor: 'black',
                opacity: 0.2
              }
            }}
          >
            <PersistGate loading={null} persistor={persistor}>
              <DBStateProvider>
                <>
                  <ErrorBoundary>
                    <AppNavigator
                      screenProps={{ theme: currentTheme }}
                      onNavigationStateChange={this.onNavigationStateChange}
                    />
                  </ErrorBoundary>
                  <Changelog />
                </>
              </DBStateProvider>
            </PersistGate>
          </MenuProvider>
        </PaperProvider>
      </ThemeProvider>
    )
  }
}

export default compose(
  connect(state => ({
    theme: state.user.bible.settings.theme,
    fontFamily: state.user.fontFamily
  })),
  withFireAuth
)(InitApp)
