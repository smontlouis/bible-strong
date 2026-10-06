export const SITE_ORIGIN = 'https://bible-strong.app'
export const WEB_APP_ORIGIN = 'https://web.bible-strong.app'

export const RESOURCE_LANGUAGES = ['fr', 'en'] as const
export type ResourceLanguage = (typeof RESOURCE_LANGUAGES)[number]
export const DEFAULT_RESOURCE_LANGUAGE: ResourceLanguage = 'fr'

export const isResourceLanguage = (value: string | undefined): value is ResourceLanguage =>
  value === 'fr' || value === 'en'

/**
 * Editorial content only changes when a resource is republished, so the CDN may keep a
 * rendered page for a day and serve it stale while it revalidates.
 */
export const RESOURCE_PAGE_CACHE_CONTROL =
  'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'

export const absoluteSiteUrl = (path: string): string => `${SITE_ORIGIN}${path}`

/** Fonts of the first screen of a reading page, declared `optional` in resource-pages.css. */
export const RESOURCE_FONT_PRELOADS = [
  '/fonts/LiterataBook.otf',
  '/fonts/UpType%20-%20Pulp%20Display%20Regular.otf',
  '/fonts/UpType%20-%20Pulp%20Display%20Semi%20Bold.otf',
].map(href => ({
  rel: 'preload',
  as: 'font',
  type: 'font/otf',
  href,
  crossOrigin: 'anonymous' as const,
}))
