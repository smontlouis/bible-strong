import { useRouterState } from '@tanstack/react-router'
import en from './en'
import fr from './fr'

export type Locale = 'en' | 'fr'
type MessageKey = keyof typeof en

export function useCurrentLocale(): Locale {
  return useRouterState({ select: (state) => state.location.pathname === '/fr' || state.location.pathname.startsWith('/fr/') ? 'fr' : 'en' })
}

export function useI18n() {
  const messages = useCurrentLocale() === 'fr' ? fr : en
  return (key: MessageKey) => messages[key]
}
