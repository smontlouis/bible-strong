import React from 'react'
import { ThemeProvider } from 'emotion-theming'
import { Provider as PaperProvider } from 'react-native-paper'
import { StatusBar, AppState } from 'react-native'
import * as Segment from 'expo-analytics-segment'
import { PersistGate } from 'redux-persist/integration/react'
import { connect } from 'react-redux'
import compose from 'recompose/compose'
import Sentry from 'sentry-expo'

import { updateUserData } from '~redux/modules/user'
import withFireAuth from '~common/withFireAuth'
import AppNavigator from '~navigation/AppNavigator'
import Changelog from '~common/Changelog'
import getTheme from '~themes'
import { paperTheme } from '~themes/default'

class InitApp extends React.Component {
  componentDidMount() {
    this.changeStatusBarStyle()
    AppState.addEventListener('change', this.handleAppStateChange)
  }

  componentWillUnmount() {
    AppState.removeEventListener('change', this.handleAppStateChange)
  }

  handleAppStateChange = nextAppState => {
    if (nextAppState.match(/inactive|background/)) {
      console.log('App is in background!')
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

  onNavigationStateChange = (prevState, currentState, action) => {
    const { route: currentScreen, params: currentParams } = this.getActiveRouteName(currentState)
    const { route: prevScreen, params: prevParams } = this.getActiveRouteName(prevState)

    if (prevScreen !== currentScreen) {
      if (!__DEV__) {
        Segment.screen(currentScreen)
      }

      Sentry.captureBreadcrumb({
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
    const { theme, persistor } = this.props
    return (
      <ThemeProvider theme={getTheme[theme]}>
        <PaperProvider theme={paperTheme}>
          <PersistGate loading={null} persistor={persistor}>
            <>
              <AppNavigator
                screenProps={{ theme }}
                onNavigationStateChange={this.onNavigationStateChange}
              />
              <Changelog />
            </>
          </PersistGate>
        </PaperProvider>
      </ThemeProvider>
    )
  }
}

export default compose(
  connect(state => ({
    theme: state.user.bible.settings.theme
  })),
  withFireAuth
)(InitApp)
