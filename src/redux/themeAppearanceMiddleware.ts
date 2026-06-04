import type { Middleware } from '@reduxjs/toolkit'
import { Appearance } from 'react-native'

import type { PreferredColorScheme } from '~common/types'
import { setSettingsPreferredColorScheme } from './modules/user/settings'

const getAppearanceColorScheme = (
  preferredColorScheme: PreferredColorScheme
): Parameters<typeof Appearance.setColorScheme>[0] => {
  if (preferredColorScheme === 'auto') {
    return null as unknown as Parameters<typeof Appearance.setColorScheme>[0]
  }

  return preferredColorScheme
}

export const applyPreferredColorScheme = (preferredColorScheme: PreferredColorScheme) => {
  Appearance.setColorScheme(getAppearanceColorScheme(preferredColorScheme))
}

export const themeAppearanceMiddleware: Middleware = () => next => action => {
  const result = next(action)

  if (setSettingsPreferredColorScheme.match(action)) {
    applyPreferredColorScheme(action.payload)
  }

  return result
}
