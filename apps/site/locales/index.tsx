import { useRouterState } from '@tanstack/react-router'
import { parseBibleRoute } from '../features/bible/bibleRoutes'
import { bibleVersionPageLanguage } from '../features/bible/bibleVersions'
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
    // Resource pages carry the resource language right after the family (ADR-0054).
    const resourceLanguage = /^\/strong\/(fr|en)(?:\/|$)/u.exec(pathname)?.[1]
    if (resourceLanguage) return resourceLanguage as Locale
    const bibleRoute = pathname.startsWith('/bible/')
      ? parseBibleRoute(pathname.slice('/bible/'.length))
      : undefined
    if (bibleRoute) return bibleVersionPageLanguage(bibleRoute.version, bibleRoute.gloss)
    return pathname === '/fr' || pathname.startsWith('/fr/') ? 'fr' : 'en'
  } })
}

export function useI18n() {
  const messages = useCurrentLocale() === 'fr' ? fr : en
  return (key: MessageKey) => messages[key]
}
