import { useEffect } from 'react'
import { useSelector } from 'react-redux'

import { appLogger } from '~helpers/agentObservability'
import { storage } from '~helpers/storage.desktop'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import type { RootState } from '~redux/modules/reducer'
import { isDarkThemeName } from '~themes/darkThemes'
import getTheme, { baseTheme } from '~themes/index'

import { invoke } from './bridge'

/**
 * The ground and appearance of the current theme, which the shell reads at the next launch
 * (`appearance.rs`).
 */
export const APPEARANCE_KEY = 'desktop.appearance'

/**
 * Before a page paints, at launch and on reload, the window shows: it takes the theme's ground
 * now, and the next launch opens with it. Its title bar takes the theme's light or dark
 * appearance, or follows the system with a theme that follows it.
 */
export const useDesktopAppearance = () => {
  const { theme } = useCurrentThemeSelector()
  const followsSystem = useSelector(
    (state: RootState) => (state.user.bible.settings.preferredColorScheme || 'auto') === 'auto'
  )
  const background = (getTheme[theme] || baseTheme).colors.reverse
  const scheme = isDarkThemeName(theme) ? 'dark' : 'light'

  useEffect(() => {
    storage.set(APPEARANCE_KEY, JSON.stringify({ background, scheme, followsSystem }))
    invoke('window_set_appearance', { color: background, scheme, followsSystem }).catch(error =>
      appLogger.warn('startup', 'desktop.window_appearance_failed', { error: String(error) })
    )
  }, [background, scheme, followsSystem])
}
