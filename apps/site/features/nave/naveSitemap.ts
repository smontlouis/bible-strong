import { absoluteSiteUrl, RESOURCE_LANGUAGES, type ResourceLanguage } from '../resources/publicSite'
import type { SitemapUrl } from '../resources/sitemap'
import { loadNaveIndex } from './naveIndex'
import {
  buildNaveIndexPath,
  buildNaveLetterPath,
  buildNavePath,
  naveListPageCount,
} from './naveRoutes'

/**
 * The entry of a publication, every page of its letters and every topic. A page is given
 * its language alternates when the other publication holds it too: the entry and the
 * topics, which both publications name alike. Letters file a topic under its own name in
 * each language, so their pages have no alternate.
 */
export const listNaveSitemapUrls = async (language: ResourceLanguage): Promise<SitemapUrl[]> => {
  const indexes = await Promise.all(
    RESOURCE_LANGUAGES.map(async published => ({
      language: published,
      index: await loadNaveIndex(published),
    }))
  )
  const index = indexes.find(entry => entry.language === language)?.index
  if (!index?.topics.length) return []

  const withAlternates = (
    path: (published: ResourceLanguage) => string,
    holds: (entry: (typeof indexes)[number]) => boolean
  ): SitemapUrl => {
    const alternates = indexes.filter(holds).map(entry => ({
      hrefLang: entry.language,
      href: absoluteSiteUrl(path(entry.language)),
    }))
    return {
      loc: absoluteSiteUrl(path(language)),
      ...(alternates.length > 1 ? { alternates } : {}),
    }
  }

  return [
    withAlternates(buildNaveIndexPath, entry => entry.index.topics.length > 0),
    ...[...index.byLetter].flatMap(([letter, topics]) =>
      Array.from({ length: naveListPageCount(topics.length) }, (_, page) => ({
        loc: absoluteSiteUrl(buildNaveLetterPath(language, letter, page + 1)),
      }))
    ),
    ...index.topics.map(topic =>
      withAlternates(
        published => buildNavePath(published, topic.normalizedName),
        entry => entry.index.positions.has(topic.normalizedName)
      )
    ),
  ]
}

/** One sitemap per publication: `nave-fr.xml` and `nave-en.xml`. */
export const NAVE_SITEMAPS: Record<string, () => Promise<SitemapUrl[]> | SitemapUrl[]> =
  Object.fromEntries(
    RESOURCE_LANGUAGES.map(language => [
      `nave-${language}.xml`,
      () => listNaveSitemapUrls(language),
    ])
  )
