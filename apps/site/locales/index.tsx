import { useRouterState } from '@tanstack/react-router'
import { parseBibleRoute } from '../features/bible/bibleRoutes'
import { bibleVersionPageLanguage, findBibleVersion } from '../features/bible/bibleVersions'
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
    const resourceLanguage =
      /^\/(?:strong|dictionary|nave|commentary|timeline)\/(fr|en)(?:\/|$)/u.exec(pathname)?.[1]
    if (resourceLanguage) return resourceLanguage as Locale
    if (pathname.startsWith('/bible/')) {
      const path = pathname.slice('/bible/'.length)
      const bibleRoute = parseBibleRoute(path)
      if (bibleRoute) return bibleVersionPageLanguage(bibleRoute.version, bibleRoute.gloss)
      // `/bible/:version`, the books of a version.
      const version = findBibleVersion(path.split('/')[0])
      if (version) return bibleVersionPageLanguage(version)
    }
    return pathname === '/fr' || pathname.startsWith('/fr/') ? 'fr' : 'en'
  } })
}

export function useI18n() {
  const messages = useCurrentLocale() === 'fr' ? fr : en
  return (key: MessageKey) => messages[key]
}
