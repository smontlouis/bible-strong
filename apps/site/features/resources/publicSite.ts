export const SITE_ORIGIN = 'https://bible-strong.app'
export const WEB_APP_ORIGIN = 'https://web.bible-strong.app'

export const RESOURCE_LANGUAGES = ['fr', 'en'] as const
export type ResourceLanguage = (typeof RESOURCE_LANGUAGES)[number]
export const DEFAULT_RESOURCE_LANGUAGE: ResourceLanguage = 'fr'

export const isResourceLanguage = (value: string | undefined): value is ResourceLanguage =>
  value === 'fr' || value === 'en'

/**
 * Editorial content only changes when a resource is republished, and the pages of a
 * republished resource are asked to be rendered again (ADR-0084): Cloudflare may keep a
 * rendered page for a month, and serve it stale for a week more while it renders a new one.
 * The browser asks again each time.
 */
export const RESOURCE_PAGE_CACHE_CONTROL =
  'public, max-age=0, s-maxage=2592000, stale-while-revalidate=604800'

export const absoluteSiteUrl = (path: string): string => `${SITE_ORIGIN}${path}`

/** The home page of the site in each of its languages. */
export const HOME_PATHS: Record<ResourceLanguage, string> = { en: '/', fr: '/fr' }

const pulpDisplay = (weight: string): string =>
  `/fonts/UpType%20-%20Pulp%20Display%20${weight.replace(/ /gu, '%20')}.otf`

const fontPreload = (href: string) => ({
  rel: 'preload',
  as: 'font',
  type: 'font/otf',
  href,
  crossOrigin: 'anonymous' as const,
})

/** Fonts of the first screen of a reading page, declared `optional` in resource-pages.css. */
export const RESOURCE_FONT_PRELOADS = [
  '/fonts/LiterataBook.otf',
  pulpDisplay('Regular'),
  pulpDisplay('Semi Bold'),
].map(fontPreload)

/**
 * The weights the first screen of the home page is set in, in both languages: they are asked
 * for with the page, not after its styles, so the text is rarely painted in another font first.
 */
export const HOME_FONT_PRELOADS = ['Regular', 'Semi Bold', 'Bold'].map(weight =>
  fontPreload(pulpDisplay(weight))
)
