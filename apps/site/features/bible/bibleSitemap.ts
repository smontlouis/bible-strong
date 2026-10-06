import { absoluteSiteUrl, RESOURCE_LANGUAGES } from '../resources/publicSite'
import type { SitemapUrl } from '../resources/sitemap'
import { listBibleChapters } from './bible.functions'
import { buildBiblePath, type BiblePresentation } from './bibleRoutes'

/**
 * One page per chapter of a version in one reading mode; verse pages are reached from
 * their chapter. The interlinear reading lists its French and English glosses.
 */
export const listBibleSitemapUrls = async (
  versionId: string,
  presentation: BiblePresentation
): Promise<SitemapUrl[]> =>
  (await listBibleChapters(versionId)).flatMap(({ book, chapter }) => {
    const location = { versionId, presentation, book, chapter }
    if (presentation !== 'interlinear') {
      return [{ loc: absoluteSiteUrl(buildBiblePath(location)) }]
    }
    const alternates = RESOURCE_LANGUAGES.map(gloss => ({
      hrefLang: gloss,
      href: absoluteSiteUrl(buildBiblePath({ ...location, gloss })),
    }))
    return alternates.map(alternate => ({ loc: alternate.href, alternates }))
  })
