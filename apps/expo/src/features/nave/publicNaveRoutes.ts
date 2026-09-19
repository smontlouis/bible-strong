import type { ResourceLanguage } from '~helpers/databaseTypes'

export type PublicNaveRoute = {
  language: ResourceLanguage
  topic: string
}

export const parsePublicNaveRoute = (
  language: string | string[] | undefined,
  topic: string | string[] | undefined
): PublicNaveRoute | undefined => {
  const lang = Array.isArray(language) ? language[0] : language
  const name = (Array.isArray(topic) ? topic[0] : topic)?.trim()
  return (lang === 'fr' || lang === 'en') && name ? { language: lang, topic: name } : undefined
}

export const buildPublicNavePath = ({ language, topic }: PublicNaveRoute): string => {
  const normalized = topic.trim()
  if (!normalized) throw new Error('PUBLIC_NAVE_ROUTE_INVALID')
  return `/nave/${language}/${encodeURIComponent(normalized)}`
}
