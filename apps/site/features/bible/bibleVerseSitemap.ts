import { absoluteSiteUrl } from '../resources/publicSite'
import type { SitemapUrl } from '../resources/sitemap'
import { buildBiblePath } from './bibleRoutes'
import { listBibleVerseNumbers } from './bibleVerseNumbers'
import { MAIN_BIBLE_VERSIONS } from './bibleVerseRules'
import { bibleVersionSlug } from './bibleVersions'

/**
 * The verse pages of a version, one per verse it numbers. A Bible holds about 31,000
 * verses, under the 50,000 addresses one sitemap file may list, so a version is one file.
 */
export const listBibleVerseSitemapUrls = async (versionId: string): Promise<SitemapUrl[]> =>
  (await listBibleVerseNumbers(versionId)).flatMap(({ book, chapter, verses }) =>
    verses.map(startVerse => ({
      loc: absoluteSiteUrl(buildBiblePath({ versionId, book, chapter, passage: { startVerse } })),
    }))
  )

/**
 * One sitemap of verse pages per well-known Bible of each language, such as
 * `bible-lsg-verses.xml`. A verse has a page in every version, and every one of them is
 * indexable; a sitemap names the versions a reader is most likely to look a verse up in.
 */
export const BIBLE_VERSE_SITEMAPS: Record<string, () => Promise<SitemapUrl[]>> = Object.fromEntries(
  Object.values(MAIN_BIBLE_VERSIONS)
    .flat()
    .map(versionId => [
      `bible-${bibleVersionSlug(versionId)}-verses.xml`,
      () => listBibleVerseSitemapUrls(versionId),
    ])
)
