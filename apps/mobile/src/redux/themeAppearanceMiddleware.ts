import type { Middleware } from '@reduxjs/toolkit'
import { Appearance } from 'react-native'

import type { PreferredColorScheme } from '~common/types'
import { setSettingsPreferredColorScheme } from './modules/user/settings'

export const applyPreferredColorScheme = (preferredColorScheme: PreferredColorScheme) => {
  Appearance.setColorScheme(preferredColorScheme === 'auto' ? 'unspecified' : preferredColorScheme)
}

export const themeAppearanceMiddleware: Middleware = () => next => action => {
  const result = next(action)

  if (setSettingsPreferredColorScheme.match(action)) {
    applyPreferredColorScheme(action.payload)
  }

  return result
}
