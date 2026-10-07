import {
  absoluteSiteUrl,
  RESOURCE_FONT_PRELOADS,
  RESOURCE_LANGUAGES,
} from '../resources/publicSite'
import { breadcrumbScripts } from '../resources/resourceHead'
import type { StrongConcordancePageData } from './strong.functions'
import { strongConcordanceBreadcrumbs } from './strongBreadcrumbs'
import { buildStrongConcordancePath, displayStrongTitleCode } from './strongRoutes'

export type ConcordanceSearch = { book?: string }

export const validateConcordanceSearch = (search: Record<string, unknown>): ConcordanceSearch =>
  typeof search.book === 'string' ? { book: search.book } : {}

/** A page number as written in a path: `2` and above; the first page has no number. */
export const parseConcordancePage = (value: string): number | undefined =>
  /^[1-9]\d{0,4}$/u.test(value) ? Number(value) : undefined

const TITLES = {
  fr: (code: string, word: string, version: string) =>
    `Concordance Strong ${code} – ${word} dans la Bible (${version})`,
  en: (code: string, word: string, version: string) =>
    `Strong’s ${code} concordance – ${word} in the Bible (${version})`,
} as const

/**
 * Every numbered page of a concordance is indexable under its own URL. A book filter only
 * rearranges those pages: it is not indexed and points to the unfiltered concordance.
 */
export const buildConcordanceHead = (page: StrongConcordancePageData) => {
  const { language, code } = page
  const filtered = page.book !== undefined
  const pagePath = (number: number) => buildStrongConcordancePath(language, code, { page: number })
  const url = absoluteSiteUrl(pagePath(filtered ? 1 : page.page))
  const numbered = !filtered && page.page > 1
  const title = `${TITLES[language](
    displayStrongTitleCode(code),
    `${page.original} (${page.gloss})`,
    page.version
  )}${numbered ? ` – page ${page.page}` : ''}`
  const description =
    language === 'fr'
      ? `${title} : ${page.verseCount.toLocaleString('fr')} versets, page ${page.page} sur ${page.pageCount}.`
      : `${title}: ${page.verseCount.toLocaleString('en')} verses, page ${page.page} of ${page.pageCount}.`

  return {
    meta: [
      { title },
      { name: 'description', content: description },
      ...(filtered ? [{ name: 'robots', content: 'noindex, follow' }] : []),
      { property: 'og:title', content: title },
      { property: 'og:url', content: url },
      { property: 'og:type', content: 'article' },
    ],
    links: [
      ...RESOURCE_FONT_PRELOADS,
      { rel: 'canonical', href: url },
      ...(!filtered && page.page > 1
        ? [{ rel: 'prev', href: absoluteSiteUrl(pagePath(page.page - 1)) }]
        : []),
      ...(!filtered && page.page < page.pageCount
        ? [{ rel: 'next', href: absoluteSiteUrl(pagePath(page.page + 1)) }]
        : []),
      // The other language reads another Bible, whose pages do not line up beyond the first.
      ...(!filtered && page.page === 1
        ? RESOURCE_LANGUAGES.map(alternate => ({
            rel: 'alternate',
            hrefLang: alternate,
            href: absoluteSiteUrl(buildStrongConcordancePath(alternate, code)),
          }))
        : []),
    ],
    scripts: breadcrumbScripts(strongConcordanceBreadcrumbs(page)),
  }
}
