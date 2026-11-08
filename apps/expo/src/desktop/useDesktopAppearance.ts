import { useEffect } from 'react'

import { appLogger } from '~helpers/agentObservability'
import { storage } from '~helpers/storage.desktop'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { isDarkThemeName } from '~themes/darkThemes'
import getTheme, { baseTheme } from '~themes/index'

import { invoke } from './bridge'

/** The ground of the current theme, which the shell reads at the next launch (`appearance.rs`). */
export const APPEARANCE_KEY = 'desktop.appearance'

/**
 * Before a page paints, at launch and on reload, the window shows: it takes the theme's ground
 * now, and the next launch opens with it.
 */
export const useDesktopAppearance = () => {
  const { theme } = useCurrentThemeSelector()
  const background = (getTheme[theme] || baseTheme).colors.reverse
  const scheme = isDarkThemeName(theme) ? 'dark' : 'light'

  useEffect(() => {
    storage.set(APPEARANCE_KEY, JSON.stringify({ background, scheme }))
    invoke('window_set_background', { color: background }).catch(error =>
      appLogger.warn('startup', 'desktop.window_background_failed', { error: String(error) })
    )
  }, [background, scheme])
}
