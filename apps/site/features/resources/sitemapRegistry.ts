import { listBibleSitemapUrls } from '../bible/bibleSitemap'
import { supportedBiblePresentations } from '../bible/bibleRoutes'
import { BIBLE_VERSIONS, bibleVersionSlug } from '../bible/bibleVersions'
import { listStrongIndexSitemapUrls, listStrongSitemapUrls } from '../strong/strongSitemap'
import { absoluteSiteUrl } from './publicSite'
import type { SitemapUrl } from './sitemap'

const HOME_ALTERNATES = [
  { hrefLang: 'en', href: absoluteSiteUrl('/') },
  { hrefLang: 'fr', href: absoluteSiteUrl('/fr') },
]

/** Every sitemap served under `/sitemaps/:name`, listed by `/sitemap.xml`. */
export const SITEMAPS: Record<string, () => Promise<SitemapUrl[]> | SitemapUrl[]> = {
  'pages.xml': () => HOME_ALTERNATES.map(({ href }) => ({ loc: href, alternates: HOME_ALTERNATES })),
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
}
