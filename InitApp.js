import React from 'react'
import { ThemeProvider } from 'emotion-theming'
import { Provider as PaperProvider } from 'react-native-paper'
import { StatusBar } from 'react-native'
import { PersistGate } from 'redux-persist/integration/react'
import { connect } from 'react-redux'

import AppNavigator from '~navigation/AppNavigator'
import getTheme from '~themes'
import { paperTheme } from '~themes/default'

class InitApp extends React.Component {
  componentDidMount () {
    this.changeStatusBarStyle()
  }
  componentDidUpdate (prevProps) {
    if (prevProps.theme !== this.props.theme) {
      this.changeStatusBarStyle()
    }
  }

  changeStatusBarStyle = () => {
    if (this.props.theme === 'dark') StatusBar.setBarStyle('light-content')
    else StatusBar.setBarStyle('dark-content')
  }

  render () {
    const { theme, persistor } = this.props
    return (
      <ThemeProvider theme={getTheme[theme]}>
        <PaperProvider theme={paperTheme}>
          <PersistGate loading={null} persistor={persistor}>
            <AppNavigator screenProps={{ theme }} />
          </PersistGate>
        </PaperProvider>
      </ThemeProvider>
    )
  }
}

export default connect(
  (state) => ({
    theme: state.user.bible.settings.theme
  })
)(
  InitApp
)
