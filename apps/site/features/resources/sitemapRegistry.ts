import { listBibleSitemapUrls } from '../bible/bibleSitemap'
import { COMMENTARY_SITEMAPS } from '../commentary/commentarySitemap'
import { DICTIONARY_SITEMAPS } from '../dictionary/dictionarySitemap'
import { NAVE_SITEMAPS } from '../nave/naveSitemap'
import { buildBibleVersionPath, supportedBiblePresentations } from '../bible/bibleRoutes'
import { BIBLE_VERSIONS, bibleVersionSlug } from '../bible/bibleVersions'
import { listStrongIndexSitemapUrls, listStrongSitemapUrls } from '../strong/strongSitemap'
import { TIMELINE_SITEMAPS } from '../timeline/timelineSitemap'
import { absoluteSiteUrl } from './publicSite'
import { resourceSection } from './sections'
import type { SitemapUrl } from './sitemap'

const BIBLE_SECTION = resourceSection('bible')

const alternatePages = (paths: Record<'en' | 'fr', string>): SitemapUrl[] => {
  const alternates = Object.entries(paths).map(([hrefLang, path]) => ({
    hrefLang,
    href: absoluteSiteUrl(path),
  }))
  return alternates.map(({ href }) => ({ loc: href, alternates }))
}

/** Every sitemap served under `/sitemaps/:name`, listed by `/sitemap.xml`. */
export const SITEMAPS: Record<string, () => Promise<SitemapUrl[]> | SitemapUrl[]> = {
  'pages.xml': () => [
    ...alternatePages({ en: '/', fr: '/fr' }),
    ...alternatePages({ en: BIBLE_SECTION.path('en'), fr: BIBLE_SECTION.path('fr') }),
  ],
  // The books and chapters of each Bible; their chapters follow, one sitemap per reading mode.
  'bible-versions.xml': () =>
    BIBLE_VERSIONS.map(version => ({ loc: absoluteSiteUrl(buildBibleVersionPath(version.id)) })),
  'strong-index.xml': listStrongIndexSitemapUrls,
  'strong-hebrew.xml': () => listStrongSitemapUrls('hebrew'),
  'strong-greek.xml': () => listStrongSitemapUrls('greek'),
  // One sitemap per Bible and reading mode: `bible-lsg.xml`, `bible-lsg-strong.xml`, …
  ...Object.fromEntries(
    BIBLE_VERSIONS.flatMap(version =>
      supportedBiblePresentations(version.id).map(presentation => [
        `bible-${bibleVersionSlug(version.id)}${presentation === 'text' ? '' : `-${presentation}`}.xml`,
        () => listBibleSitemapUrls(version.id, presentation),
      ])
    )
  ),
  ...DICTIONARY_SITEMAPS,
  ...NAVE_SITEMAPS,
  ...COMMENTARY_SITEMAPS,
  ...TIMELINE_SITEMAPS,
}
