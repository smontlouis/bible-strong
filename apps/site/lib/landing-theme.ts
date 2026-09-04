import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import type { ThemePreference } from '@/pages'

const themeCookieName = 'bible-strong-landing-theme'

export const getLandingTheme = createServerFn({ method: 'GET' }).handler((): ThemePreference => {
  const theme = getCookie(themeCookieName)

  return theme === 'light' || theme === 'dark' ? theme : 'auto'
})
