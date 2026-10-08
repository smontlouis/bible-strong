import type { CommentaryCoverageResponseDto } from '@bible-strong/resource-domain/contracts/supplementaryContract'
import { bibleBookSlug } from '../bible/bibleBooks'
import { createInstanceCache } from '../bible/instanceCache'
import type { ResourceLanguage } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'

export type CommentaryChapterRef = { book: number; chapter: number }

/** The books a commentary covers, by book number, each with its commented chapters. */
export type CommentaryCoverage = { book: number; chapters: number[] }[]

const COVERAGE_TTL_MS = 60 * 60 * 1000

// Coverage only changes when a commentary is republished; one read per hour and server instance.
const cachedCoverage = createInstanceCache<CommentaryCoverage>(COVERAGE_TTL_MS)

const ascending = (left: number, right: number): number => left - right

/** Books without an OSIS identity cannot be addressed and are left out. */
export const toCommentaryCoverage = (
  response: Pick<CommentaryCoverageResponseDto, 'books' | 'chaptersByBook'>
): CommentaryCoverage =>
  [...response.books]
    .sort(ascending)
    .map(book => ({
      book,
      chapters: [...(response.chaptersByBook[String(book)] ?? [])].sort(ascending),
    }))
    .filter(entry => entry.chapters.length > 0 && bibleBookSlug(entry.book) !== undefined)

/** The coverage of a publication in a language; an absent publication is `undefined`. */
export const readCommentaryCoverage = (
  publicationId: string,
  language: ResourceLanguage
): Promise<CommentaryCoverage | undefined> =>
  cachedCoverage(`${publicationId}:${language}`, async () => {
    const response = await readResource<CommentaryCoverageResponseDto>(
      `/v1/commentaries/${encodeURIComponent(publicationId)}/${language}/coverage`
    )
    return response && toCommentaryCoverage(response)
  })

export const commentaryCovers = (
  coverage: CommentaryCoverage,
  { book, chapter }: CommentaryChapterRef
): boolean => coverage.some(entry => entry.book === book && entry.chapters.includes(chapter))

/** Every commented chapter, in reading order. */
export const listCommentaryChapters = (coverage: CommentaryCoverage): CommentaryChapterRef[] =>
  coverage.flatMap(({ book, chapters }) => chapters.map(chapter => ({ book, chapter })))

/** The commented chapters before and after one; a commentary may skip chapters and books. */
export const adjacentCommentaryChapters = (
  coverage: CommentaryCoverage,
  { book, chapter }: CommentaryChapterRef
): { previous?: CommentaryChapterRef; next?: CommentaryChapterRef } => {
  const chapters = listCommentaryChapters(coverage)
  const index = chapters.findIndex(ref => ref.book === book && ref.chapter === chapter)
  return index < 0 ? {} : { previous: chapters[index - 1], next: chapters[index + 1] }
}
