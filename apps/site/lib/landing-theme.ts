import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import {
  isThemePreference,
  themeCookieName,
  type ThemePreference,
} from '@/components/SiteThemeControls'

export const getLandingTheme = createServerFn({ method: 'GET' }).handler((): ThemePreference => {
  const theme = getCookie(themeCookieName)

  return isThemePreference(theme) && theme !== 'auto' ? theme : 'auto'
})
