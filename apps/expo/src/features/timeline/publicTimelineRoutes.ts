import type { ResourceLanguage } from '~helpers/databaseTypes'

export type PublicTimelineRoute = {
  language: ResourceLanguage
  slug?: string
}

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim().toLocaleLowerCase()

const isSlug = (value: string | undefined): value is string =>
  !!value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)

export const parsePublicTimelineRoute = (params: {
  language?: string | string[]
  slug?: string | string[]
}): PublicTimelineRoute | undefined => {
  const language = first(params.language)
  const slug = first(params.slug)
  if (language !== 'fr' && language !== 'en') return undefined
  if (slug !== undefined && !isSlug(slug)) return undefined
  return { language, ...(slug ? { slug } : {}) }
}

export const buildPublicTimelineIndexPath = (language: ResourceLanguage) => `/timeline/${language}`

export const buildPublicTimelineEventPath = ({
  language,
  slug,
}: Required<PublicTimelineRoute>): string => {
  if (!isSlug(slug)) throw new Error('PUBLIC_TIMELINE_ROUTE_INVALID')
  return `${buildPublicTimelineIndexPath(language)}/${slug}`
}
