import { bibleBookSlug, findBibleBook } from '../bible/bibleBooks'
import {
  isResourceLanguage,
  WEB_APP_ORIGIN,
  type ResourceLanguage,
} from '../resources/publicSite'

/** A chapter of a commentary: the catalog Resource identity, its language and the chapter. */
export type CommentaryLocation = {
  language: ResourceLanguage
  resource: string
  book: number
  chapter: number
}

export type CommentaryRoute = CommentaryLocation & {
  /** The suffix of a deterministic section ID: `1-21`, or `1-21-2` for a second one. */
  section?: string
}

// Catalog Resource identities are lowercase words joined by hyphens (`mhy-fr`, `kd`).
const RESOURCE_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/u
// First and last verse, then the rank of the section among those sharing that range.
const SECTION_PATTERN = /^\d{1,3}-\d{1,3}(?:-\d{1,4})?$/u
const MAX_PAGE = 9999

const parsePositiveInteger = (value: string | undefined): number | undefined => {
  if (!value || !/^\d{1,3}$/u.test(value)) return undefined
  const parsed = Number(value)
  return parsed > 0 ? parsed : undefined
}

/** The language a page switches to: the site speaks two. */
export const otherResourceLanguage = (language: ResourceLanguage): ResourceLanguage =>
  language === 'fr' ? 'en' : 'fr'

export const isCommentaryResourceSlug = (value: string | undefined): value is string =>
  value !== undefined && RESOURCE_PATTERN.test(value)

/**
 * Parses the grammar of ADR-0054:
 *
 * - `/commentary/:language/:resource/:book/:chapter`
 * - `/commentary/:language/:resource/:book/:chapter/:section`
 *
 * Any spelling of an OSIS book identity is read, so that a route can redirect it to the
 * canonical one. The resource and the chapter still have to be checked against the
 * catalog and the coverage of the commentary.
 */
export const parseCommentaryRoute = (params: {
  language?: string
  resource?: string
  book?: string
  chapter?: string
  section?: string
}): CommentaryRoute | undefined => {
  const { language, resource, section } = params
  if (!isResourceLanguage(language) || !isCommentaryResourceSlug(resource)) return undefined
  const book = findBibleBook(params.book)
  const chapter = parsePositiveInteger(params.chapter)
  if (!book || !chapter) return undefined
  if (section !== undefined && !SECTION_PATTERN.test(section)) return undefined
  return { language, resource, book, chapter, ...(section === undefined ? {} : { section }) }
}

/** The commentaries available in a language. */
export const buildCommentaryIndexPath = (language: ResourceLanguage): string =>
  `/commentary/${language}`

/** A commentary: its notice and the chapters it covers. */
export const buildCommentaryPath = (language: ResourceLanguage, resource: string): string =>
  `/commentary/${language}/${resource}`

/** The path parameters of a chapter, in their canonical spelling. */
export const commentaryRouteParams = ({ language, resource, book, chapter }: CommentaryLocation) => {
  const bookSlug = bibleBookSlug(book)
  if (!bookSlug || !isCommentaryResourceSlug(resource)) throw new Error('COMMENTARY_ROUTE_INVALID')
  return { language, resource, book: bookSlug, chapter: String(chapter) }
}

/**
 * The commentary of a chapter. A commentary too long for one page continues on numbered
 * pages; the first one has no number.
 */
export const buildCommentaryChapterPath = (location: CommentaryLocation, page = 1): string => {
  const { language, resource, book, chapter } = commentaryRouteParams(location)
  return `${buildCommentaryPath(language, resource)}/${book}/${chapter}${
    page > 1 ? `?page=${page}` : ''
  }`
}

/** The address of a section, which leads to the page of its chapter that carries it. */
export const buildCommentarySectionPath = (location: CommentaryLocation, section: string): string =>
  `${buildCommentaryChapterPath(location)}/${section}`

/**
 * The anchor of a section in its chapter page, which the address of the section resolves
 * to. It is prefixed like the verse anchors of a Bible page.
 */
export const commentarySectionAnchor = (section: string): string => `v${section}`

export type CommentarySearch = { page?: number }

/** A page number as written in a query string; anything else reads as the first page. */
export const validateCommentarySearch = (search: Record<string, unknown>): CommentarySearch => {
  const page = typeof search.page === 'string' ? Number(search.page) : search.page
  return typeof page === 'number' && Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE
    ? { page }
    : {}
}

/** The study workspace shares this grammar, so the same path opens the same chapter. */
export const buildWebAppCommentaryUrl = (location: CommentaryLocation): string =>
  `${WEB_APP_ORIGIN}${buildCommentaryChapterPath(location)}`

/** The commentary library of the study workspace. */
export const WEB_APP_COMMENTARIES_URL = `${WEB_APP_ORIGIN}/commentaries`
