import React from 'react'
import { ThemeProvider } from 'emotion-theming'
import { PersistGate } from 'redux-persist/integration/react'
import { connect } from 'react-redux'

import AppNavigator from '~navigation/AppNavigator'
import getTheme from '~themes'

const InitApp = ({ theme, persistor }) => (
  <ThemeProvider theme={getTheme[theme]}>
    <PersistGate loading={null} persistor={persistor}>
      <AppNavigator screenProps={{ theme }} />
    </PersistGate>
  </ThemeProvider>
)

export default connect(
  (state) => ({
    theme: state.user.bible.settings.theme
  })
)(
  InitApp
)
