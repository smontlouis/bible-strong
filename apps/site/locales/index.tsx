import { useRouterState } from '@tanstack/react-router'
import en from './en'
import fr from './fr'

export type Locale = 'en' | 'fr'
type MessageKey = keyof typeof en

export function useCurrentLocale(): Locale {
  return useRouterState({ select: (state) => {
    const pathname = state.location.pathname.replace(/\/$/, '')
    // Preserve the language of existing legal URLs, including legacy aliases.
    if (pathname === '/politique-de-confidentialite' || pathname === '/eula') return 'fr'
    if (pathname === '/fr/privacy-policy' || pathname === '/fr/eula-en') return 'en'
    return pathname === '/fr' || pathname.startsWith('/fr/') ? 'fr' : 'en'
  } })
}

export function useI18n() {
  const messages = useCurrentLocale() === 'fr' ? fr : en
  return (key: MessageKey) => messages[key]
}
