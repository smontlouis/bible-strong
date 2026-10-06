import type { CommentaryChapterResponseDto } from '@bible-strong/resource-domain/contracts/supplementaryContract'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { bibleBookName } from '../bible/bibleBooks'
import { BIBLE_VERSIONS, bibleVersionCoversBook, defaultBibleVersionId } from '../bible/bibleVersions'
import { truncateText } from '../resources/editorialHtml'
import { buildBibleReferencePath } from '../resources/editorialLinks'
import { isResourceLanguage, type ResourceLanguage } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import {
  findCommentary,
  findCommentaryCounterpart,
  listCommentaries,
  type Commentary,
} from './commentaryCatalog'
import {
  adjacentCommentaryChapters,
  commentaryCovers,
  readCommentaryCoverage,
  type CommentaryChapterRef,
  type CommentaryCoverage,
} from './commentaryCoverage'
import { commentaryExcerpt, renderCommentaryHtml } from './commentaryHtml'
import { otherResourceLanguage, parseCommentaryRoute } from './commentaryRoutes'
import {
  buildCommentarySections,
  decodeCommentaryChapter,
  paginateCommentarySections,
} from './commentarySections'

const DESCRIPTION_LENGTH = 155
// A description opens on the first comments of the page; three are enough to fill it.
const DESCRIPTION_SECTION_COUNT = 3

export type CommentaryIndexPageData = {
  language: ResourceLanguage
  commentaries: Commentary[]
}

/** `/commentary/:language` — the commentaries published in a language. */
export const loadCommentaryIndexPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string }) => data)
  .handler(async ({ data }): Promise<CommentaryIndexPageData> => {
    if (!isResourceLanguage(data.language)) throw notFound()
    return { language: data.language, commentaries: listCommentaries(data.language) }
  })

export type CommentaryPageData = {
  language: ResourceLanguage
  commentary: Commentary
  coverage: CommentaryCoverage
  /** The Resource identity of the same work in the other language, when it is published. */
  counterpart?: string
}

/**
 * What the same work covers in the other language. Alternates are a refinement: a failed
 * read must not fail the page.
 */
const readCounterpartCoverage = async (
  commentary: Commentary,
  language: ResourceLanguage
): Promise<CommentaryCoverage | undefined> => {
  const counterpart = findCommentaryCounterpart(commentary, language)
  return counterpart
    ? readCommentaryCoverage(counterpart.publicationId, otherResourceLanguage(language)).catch(
        () => undefined
      )
    : undefined
}

/** `/commentary/:language/:resource` — a commentary and the chapters it covers. */
export const loadCommentaryPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; resource: string }) => data)
  .handler(async ({ data }): Promise<CommentaryPageData> => {
    if (!isResourceLanguage(data.language)) throw notFound()
    const language = data.language
    const commentary = findCommentary(language, data.resource)
    if (!commentary) throw notFound()
    const coverage = await readCommentaryCoverage(commentary.publicationId, language)
    if (!coverage?.length) throw notFound()
    const counterpartCoverage = await readCounterpartCoverage(commentary, language)
    return {
      language,
      commentary,
      coverage,
      counterpart: counterpartCoverage?.length ? commentary.counterpartId : undefined,
    }
  })

type CommentaryChapterRequest = {
  language: string
  resource: string
  book: string
  chapter: string
}

/** The sections of a chapter, cut into the pages they are read on. */
const loadChapter = async (request: CommentaryChapterRequest) => {
  const route = parseCommentaryRoute(request)
  const commentary = route && findCommentary(route.language, route.resource)
  if (!route || !commentary) throw notFound()
  const coverage = await readCommentaryCoverage(commentary.publicationId, route.language)
  if (!coverage || !commentaryCovers(coverage, route)) throw notFound()

  const response = await readResource<CommentaryChapterResponseDto>(
    `/v1/commentaries/${encodeURIComponent(commentary.publicationId)}/${route.language}/chapters/${route.book}/${route.chapter}`
  )
  const sections = response
    ? buildCommentarySections(commentary.id, decodeCommentaryChapter(response.serializedComments))
    : []
  if (!sections.length) throw notFound()
  return { route, commentary, coverage, pages: paginateCommentarySections(sections) }
}

export type CommentaryPageSection = {
  /** The section segment of the route grammar, and the anchor of the section. */
  slug: string
  /** Verse 0 stands for the introduction of the chapter. */
  startVerse: number
  endVerse: number
  html: string
}

export type CommentaryChapterPageData = {
  language: ResourceLanguage
  commentary: Commentary
  book: number
  chapter: number
  /** The sections read on this page, in reading order. */
  sections: CommentaryPageSection[]
  page: number
  pageCount: number
  previous?: CommentaryChapterRef
  next?: CommentaryChapterRef
  /** The Resource identity of the same work in the other language, when it comments this chapter. */
  counterpart?: string
  /** The chapter in the reference Bible of the language, when that Bible carries the book. */
  biblePath?: string
  description: string
}

/** `/commentary/:language/:resource/:book/:chapter` — the commentary of a chapter. */
export const loadCommentaryChapterPage = createServerFn({ method: 'GET' })
  .validator((data: CommentaryChapterRequest & { page?: number }) => data)
  .handler(async ({ data }): Promise<CommentaryChapterPageData> => {
    const { route, commentary, coverage, pages } = await loadChapter(data)
    const { language, book, chapter } = route
    const page = data.page ?? 1
    const sections = (Number.isSafeInteger(page) ? (pages[page - 1] ?? []) : [])
      .map(({ content, ...section }) => ({
        ...section,
        html: renderCommentaryHtml(content, { language }),
      }))
      // A section that only held a link out of the site has nothing left to read.
      .filter(section => section.html.trim())
    if (!sections.length) throw notFound()

    const counterpartCoverage = await readCounterpartCoverage(commentary, language)
    const referenceBible = BIBLE_VERSIONS.find(
      version => version.id === defaultBibleVersionId(language)
    )
    const reference = `${bibleBookName(book, language)} ${chapter}`
    const opening = sections
      .slice(0, DESCRIPTION_SECTION_COUNT)
      .map(section => section.html)
      .join(' ')

    return {
      language,
      commentary,
      book,
      chapter,
      sections,
      page,
      pageCount: pages.length,
      ...adjacentCommentaryChapters(coverage, route),
      counterpart:
        counterpartCoverage && commentaryCovers(counterpartCoverage, route)
          ? commentary.counterpartId
          : undefined,
      biblePath:
        referenceBible && bibleVersionCoversBook(referenceBible, book)
          ? buildBibleReferencePath(language, { book, chapter })
          : undefined,
      description: truncateText(
        `${commentary.title}, ${reference}${language === 'fr' ? ' : ' : ': '}${commentaryExcerpt(opening, DESCRIPTION_LENGTH)}`,
        DESCRIPTION_LENGTH
      ),
    }
  })

/**
 * `/commentary/:language/:resource/:book/:chapter/:section` — where a section is read: the
 * page of its chapter that carries it.
 */
export const locateCommentarySection = createServerFn({ method: 'GET' })
  .validator((data: CommentaryChapterRequest & { section: string }) => data)
  .handler(async ({ data }): Promise<{ page: number }> => {
    const { pages } = await loadChapter(data)
    const index = pages.findIndex(sections =>
      sections.some(section => section.slug === data.section)
    )
    if (index < 0) throw notFound()
    return { page: index + 1 }
  })
