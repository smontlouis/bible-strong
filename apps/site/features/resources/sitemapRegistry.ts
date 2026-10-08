import { listBibleSitemapUrls } from '../bible/bibleSitemap'
import { BIBLE_VERSE_SITEMAPS } from '../bible/bibleVerseSitemap'
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

/**
 * Whether `/sitemap.xml` announces the sitemaps of the verse pages. They are served under
 * `/sitemaps/:name` either way, so they can be checked and submitted by hand; `true` lets
 * every crawler find them. This is the only switch.
 */
export const ANNOUNCE_BIBLE_VERSE_SITEMAPS = false

/** Every sitemap served under `/sitemaps/:name`. */
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
  // One sitemap of verse pages per well-known Bible: `bible-lsg-verses.xml`, …
  ...BIBLE_VERSE_SITEMAPS,
}

/** The sitemaps `/sitemap.xml` lists: all of them, the verse ones once they are announced. */
export const listAnnouncedSitemaps = (
  announceVerses: boolean = ANNOUNCE_BIBLE_VERSE_SITEMAPS
): string[] =>
  Object.keys(SITEMAPS).filter(name => announceVerses || !(name in BIBLE_VERSE_SITEMAPS))
