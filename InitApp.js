import React from 'react'
import { ThemeProvider } from 'emotion-theming'
import { Provider as PaperProvider } from 'react-native-paper'
import { PersistGate } from 'redux-persist/integration/react'
import { connect } from 'react-redux'

import AppNavigator from '~navigation/AppNavigator'
import getTheme from '~themes'
import { paperTheme } from '~themes/default'

const InitApp = ({ theme, persistor }) => (
  <ThemeProvider theme={getTheme[theme]}>
    <PaperProvider theme={paperTheme}>
      <PersistGate loading={null} persistor={persistor}>
        <AppNavigator screenProps={{ theme }} />
      </PersistGate>
    </PaperProvider>
  </ThemeProvider>
)

export default connect(
  (state) => ({
    theme: state.user.bible.settings.theme
  })
)(
  InitApp
)
