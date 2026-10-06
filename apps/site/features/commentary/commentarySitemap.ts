import { absoluteSiteUrl, RESOURCE_LANGUAGES, type ResourceLanguage } from '../resources/publicSite'
import type { SitemapUrl } from '../resources/sitemap'
import {
  findCommentaryCounterpart,
  listCommentaryProjections,
  type Commentary,
} from './commentaryCatalog'
import {
  commentaryCovers,
  listCommentaryChapters,
  readCommentaryCoverage,
} from './commentaryCoverage'
import {
  buildCommentaryChapterPath,
  buildCommentaryIndexPath,
  buildCommentaryPath,
  otherResourceLanguage,
} from './commentaryRoutes'

/**
 * A commentary in one language: its page, then one page per commented chapter. The
 * following pages of a long chapter are reached from the first, and sections are anchors.
 * A page only names its counterpart when the same work comments it in the other language.
 */
export const listCommentarySitemapUrls = async (
  commentary: Commentary,
  language: ResourceLanguage
): Promise<SitemapUrl[]> => {
  const coverage = await readCommentaryCoverage(commentary.publicationId, language)
  if (!coverage) return []
  const otherLanguage = otherResourceLanguage(language)
  const counterpart = findCommentaryCounterpart(commentary, language)
  const counterpartCoverage = counterpart
    ? await readCommentaryCoverage(counterpart.publicationId, otherLanguage)
    : undefined
  // The same page in both languages, written the same way in the sitemap of each.
  const alternatesOf = (pathFor: (alternate: ResourceLanguage, resource: string) => string) =>
    counterpart
      ? RESOURCE_LANGUAGES.map(alternate => ({
          hrefLang: alternate,
          href: absoluteSiteUrl(
            pathFor(alternate, alternate === language ? commentary.id : counterpart.id)
          ),
        }))
      : undefined

  return [
    {
      loc: absoluteSiteUrl(buildCommentaryPath(language, commentary.id)),
      alternates: counterpartCoverage?.length ? alternatesOf(buildCommentaryPath) : undefined,
    },
    ...listCommentaryChapters(coverage).map(ref => ({
      loc: absoluteSiteUrl(
        buildCommentaryChapterPath({ language, resource: commentary.id, ...ref })
      ),
      alternates:
        counterpartCoverage && commentaryCovers(counterpartCoverage, ref)
          ? alternatesOf((alternate, resource) =>
              buildCommentaryChapterPath({ language: alternate, resource, ...ref })
            )
          : undefined,
    })),
  ]
}

const INDEX_ALTERNATES = RESOURCE_LANGUAGES.map(language => ({
  hrefLang: language,
  href: absoluteSiteUrl(buildCommentaryIndexPath(language)),
}))

/**
 * The sitemaps of the commentary pages: the list of each language, then one file per
 * commentary and language, such as `commentary-barnes-fr.xml`.
 */
export const COMMENTARY_SITEMAPS: Record<string, () => Promise<SitemapUrl[]> | SitemapUrl[]> = {
  'commentary-index.xml': () =>
    INDEX_ALTERNATES.map(({ href }) => ({ loc: href, alternates: INDEX_ALTERNATES })),
  ...Object.fromEntries(
    listCommentaryProjections()
      // A work kept out of search indexes has no sitemap.
      .filter(({ commentary }) => commentary.indexable)
      .map(({ language, commentary }) => [
        `commentary-${commentary.id}-${language}.xml`,
        () => listCommentarySitemapUrls(commentary, language),
      ])
  ),
}
