import { createSelector } from '@reduxjs/toolkit'
import { RootState } from '~redux/modules/reducer'
import {
  CurrentTheme,
  PreferredColorScheme,
  PreferredDarkTheme,
  PreferredLightTheme,
} from '~common/types'

// Base selectors
const selectUser = (state: RootState) => state.user
const selectBibleSettings = (state: RootState) => state.user.bible.settings
const selectHighlights = (state: RootState) => state.user.bible.highlights

// Selector for user login info (used in useLogin hook)
export const selectUserLoginInfo = createSelector([selectUser], user => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL,
  emailVerified: user.emailVerified,
  provider: user.provider,
  createdAt: user.createdAt,
}))

// Selector for checking if user is logged in
export const selectIsLogged = (state: RootState) => !!state.user.id

// Selector for font family
export const selectFontFamily = (state: RootState) => state.user.fontFamily

// Selector for bible settings (used in ParamsModal)
export const selectBibleSettingsForParams = createSelector(
  [selectBibleSettings, selectFontFamily],
  (settings, fontFamily) => ({
    fontFamily,
    fontSizeScale: settings.fontSizeScale,
    preferredColorScheme: settings.preferredColorScheme,
    preferredLightTheme: settings.preferredLightTheme,
    preferredDarkTheme: settings.preferredDarkTheme,
  })
)

// Selector for theme preferences
export const selectThemePreferences = createSelector([selectBibleSettings], settings => ({
  preferredColorScheme: settings.preferredColorScheme,
  preferredLightTheme: settings.preferredLightTheme,
  preferredDarkTheme: settings.preferredDarkTheme,
}))

// Selector factory for colors by current theme
export const makeColorsSelector = () =>
  createSelector(
    [selectBibleSettings, (_: RootState, currentTheme: CurrentTheme) => currentTheme],
    (settings, currentTheme) => settings.colors[currentTheme]
  )

// Selector for highlights (used in HighlightsScreen)
export const selectHighlightsObj = (state: RootState) => state.user.bible.highlights

// Selector for compare versions (used in CompareVersesTabScreen)
export const selectCompareVersions = createSelector(
  [(state: RootState) => state.user.bible.settings.compare],
  compare => Object.keys(compare)
)
