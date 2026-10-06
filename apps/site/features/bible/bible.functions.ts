import type {
  BibleChapterDto,
  BibleVersionCoverageDto,
} from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import type { InterlinearBibleChapterDto } from '@bible-strong/resource-domain/contracts/interlinearBibleContract'
import type { StrongBibleChapterDto } from '@bible-strong/resource-domain/contracts/strongBibleContract'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { listCommentaries } from '../commentary/commentaryCatalog'
import { readCommentarySections } from '../commentary/commentaryChapter'
import { commentaryExcerpt, renderCommentaryHtml } from '../commentary/commentaryHtml'
import { listCommentaryLinks, type CommentaryLink } from '../commentary/commentaryLinks'
import { buildCommentarySectionPath } from '../commentary/commentaryRoutes'
import { truncateText } from '../resources/editorialHtml'
import { parseOsisReference } from '../resources/editorialLinks'
import type { ResourceLanguage } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import { bibleBookName } from './bibleBooks'
import {
  parseInlineCommentaries,
  placeCommentarySections,
  renderInlineComments,
  withInlineCommentaries,
  type InlineComment,
} from './bibleCommentaries'
import { renderBibleText, type BibleNote, type BibleTextMarker } from './bibleLayout'
import { bibleStrongLinks, type BibleStrongLink } from './bibleStrongLinks'
import {
  buildBiblePath,
  INTERLINEAR_VERSION_ID,
  parseBibleRoute,
  type BiblePassage,
  type BiblePresentation,
} from './bibleRoutes'
import {
  BIBLE_VERSIONS,
  bibleVersionCoversBook,
  bibleVersionPageLanguage,
  findBibleVersion,
} from './bibleVersions'

const DESCRIPTION_LENGTH = 155
// A comment shown in the text is cut to three lines by the page; this fills them.
const COMMENT_EXCERPT_LENGTH = 360
const COVERAGE_TTL_MS = 60 * 60 * 1000

type StrongSpans = StrongBibleChapterDto['verses'][number]['spans']
type InterlinearToken = InterlinearBibleChapterDto['verses'][number]['tokens'][number]

export type BibleChapterRef = { book: number; chapter: number }

export type { BibleStrongLink }

/** One aligned unit of an interlinear reading, in the order of the Bible being read. */
export type BibleInterlinearWord = {
  /** The words of the Bible being read; unaligned text has nothing else. */
  text: string
  /** The original words behind a translation phrase (reverse interlinear only). */
  original?: string
  transliteration?: string
  /** The meaning of an original word, in the page language (direct interlinear only). */
  gloss?: string
  strong: BibleStrongLink[]
}

/** A verse of an interlinear reading. */
export type BiblePageVerse = {
  number: number
  /** Section titles printed before the verse. */
  headings: string[]
  words: BibleInterlinearWord[]
  /** The comments read after the verse, when commentaries are shown in the text. */
  commentsHtml?: string
}

export type BiblePageData = {
  versionId: string
  presentation: BiblePresentation
  language: ResourceLanguage
  book: number
  chapter: number
  passage?: BiblePassage
  /** The gloss language of the interlinear presentation. */
  gloss?: ResourceLanguage
  /** The reading text of the text and Strong presentations, with its notes. */
  html?: string
  notes?: BibleNote[]
  /** The aligned verses of the interlinear presentations. */
  verses?: BiblePageVerse[]
  /** The books of the version, in canon order, with their number of chapters. */
  books: { book: number; chapters: number }[]
  /** The versions carrying this passage, which the version selector may link to. */
  versionIds: string[]
  /** The commentaries of the page language that comment this chapter. */
  commentaries: CommentaryLink[]
  /** The commentaries named in the address, which the links of the page keep. */
  commentaryChoice: string[]
  /** Those of them the page language has, shown in the text in this order. */
  inlineCommentaries: { id: string; title: string }[]
  /** The comments read before the first verse of an aligned reading. */
  commentsBeforeHtml?: string
  previous?: BibleChapterRef
  next?: BibleChapterRef
  description: string
}

// Coverage only changes when a Bible is republished; one read per hour and server instance.
const coverageCache = new Map<string, { at: number; coverage: BibleVersionCoverageDto }>()

const readCoverage = async (versionId: string): Promise<BibleVersionCoverageDto | undefined> => {
  const cached = coverageCache.get(versionId)
  if (cached && Date.now() - cached.at < COVERAGE_TTL_MS) return cached.coverage
  const coverage = await readResource<BibleVersionCoverageDto>(`/v1/bibles/${versionId}/coverage`)
  if (coverage) coverageCache.set(versionId, { at: Date.now(), coverage })
  return coverage
}

const orderedChapters = (coverage: BibleVersionCoverageDto): BibleChapterRef[] => {
  const covered = new Set(coverage.books)
  return coverage.canon.orderedBooks
    .filter(book => covered.has(book))
    .flatMap(book =>
      (coverage.chaptersByBook[String(book)] ?? []).map(chapter => ({ book, chapter }))
    )
}

/** Every chapter of a version, in canon order. */
export const listBibleChapters = async (versionId: string): Promise<BibleChapterRef[]> => {
  const coverage = await readCoverage(versionId)
  return coverage ? orderedChapters(coverage) : []
}

/**
 * The versions that really carry a passage. Numbering differs between canons, so the
 * coverage of each version decides; the testament a version announces is only the
 * fallback when its coverage cannot be read.
 */
const listVersionsCarrying = async (
  book: number,
  chapter: number,
  lastVerse: number | undefined
): Promise<string[]> => {
  const carried = await Promise.all(
    BIBLE_VERSIONS.map(async version => {
      const coverage = await readCoverage(version.id).catch(() => undefined)
      if (!coverage) return bibleVersionCoversBook(version, book)
      if (!coverage.chaptersByBook[String(book)]?.includes(chapter)) return false
      const verseCount = coverage.verseCountByBookChapter[`${book}-${chapter}`]
      return lastVerse === undefined || verseCount === undefined || lastVerse <= verseCount
    })
  )
  return BIBLE_VERSIONS.filter((_, index) => carried[index]).map(version => version.id)
}

/**
 * The Strong numbers printed after a tagged word, as in the study workspace. An original
 * word the translation left out has no text to follow and shows as a dot.
 */
const strongReferencesHtml = (links: readonly BibleStrongLink[], untranslated: boolean): string =>
  links
    .map(({ code, path, label }) => {
      return untranslated
        ? `<a class="strong-ref strong-ref--untranslated" href="${path}" data-strong="${code}" aria-label="${label}" title="${label}"></a>`
        : `<a class="strong-ref" href="${path}" data-strong="${code}">${label}</a>`
    })
    .join('')

/** Original words in reading order, each with its transliteration, gloss and entries. */
const directInterlinearWords = (
  text: string,
  tokens: readonly InterlinearToken[],
  language: ResourceLanguage
): BibleInterlinearWord[] =>
  [...tokens]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map(token => ({
      text: text.slice(token.startOffset, token.startOffset + token.length),
      transliteration: token.segments.map(segment => segment.transliteration).join(''),
      gloss: token.segments
        .map(segment => segment.gloss)
        .filter(Boolean)
        .join(' '),
      strong: token.segments.flatMap(segment => bibleStrongLinks(segment.identities, language)),
    }))

type OriginalToken = { form: string; transliteration: string }

/** A translation in its own order, each tagged phrase above the original words behind it. */
const reverseInterlinearWords = (
  text: string,
  spans: StrongSpans,
  originals: ReadonlyMap<number, OriginalToken>,
  language: ResourceLanguage
): BibleInterlinearWord[] => {
  const words: BibleInterlinearWord[] = []
  let position = 0
  const pushPlain = (end: number) => {
    const plain = text.slice(position, end).trim()
    if (plain) words.push({ text: plain, strong: [] })
  }
  for (const span of [...spans].sort((left, right) => left.startOffset - right.startOffset)) {
    const end = span.startOffset + span.length
    if (span.startOffset < position || end > text.length) continue
    pushPlain(span.startOffset)
    const aligned = (span.stepTokenIds ?? []).flatMap(id => originals.get(id) ?? [])
    words.push({
      text: text.slice(span.startOffset, end),
      original: aligned.map(token => token.form).join(' ') || undefined,
      transliteration: aligned.map(token => token.transliteration).join(' ') || undefined,
      strong: bibleStrongLinks(span.identities, language),
    })
    position = end
  }
  pushPlain(text.length)
  return words
}

export type BibleVersionPageData = {
  versionId: string
  language: ResourceLanguage
  /** The books of the version, in canon order, with the chapters it carries. */
  books: { book: number; chapters: number[] }[]
}

export const loadBibleVersionPage = createServerFn({ method: 'GET' })
  .validator((data: { version: string }) => data)
  .handler(async ({ data }): Promise<BibleVersionPageData> => {
    const version = findBibleVersion(data.version)
    const coverage = version && (await readCoverage(version.id))
    if (!version || !coverage) throw notFound()
    const covered = new Set(coverage.books)
    return {
      versionId: version.id,
      language: bibleVersionPageLanguage(version),
      books: coverage.canon.orderedBooks
        .filter(book => covered.has(book))
        .map(book => ({ book, chapters: [...(coverage.chaptersByBook[String(book)] ?? [])] }))
        .filter(entry => entry.chapters.length > 0),
    }
  })

const versesByNumber = <Verse extends { number: number }>(
  verses: readonly Verse[] | undefined
): Map<number, Verse> => new Map((verses ?? []).map(verse => [verse.number, verse]))

export const loadBiblePage = createServerFn({ method: 'GET' })
  .validator((data: { path: string; commentary?: string }) => data)
  .handler(async ({ data }): Promise<BiblePageData> => {
    const route = parseBibleRoute(data.path)
    if (!route) throw notFound()
    const { version, presentation, book, chapter, passage, gloss } = route
    const language = bibleVersionPageLanguage(version, gloss)

    const coverage = await readCoverage(version.id)
    const chapters = coverage?.chaptersByBook[String(book)] ?? []
    if (!coverage || !coverage.books.includes(book) || !chapters.includes(chapter)) throw notFound()

    const lastVerse = passage?.endVerse ?? passage?.startVerse
    const chapterPath = `/books/${book}/chapters/${chapter}`
    const aligned = presentation === 'reverse-interlinear' || presentation === 'interlinear'
    // The reader's choice is kept whole in the links of the page; the text shows the
    // commentaries of that choice the page language has.
    const commentaryChoice = parseInlineCommentaries(data.commentary)
    const inlineCommentaries = listCommentaries(language).filter(commentary =>
      commentaryChoice.includes(commentary.id)
    )
    const [
      text,
      strong,
      interlinear,
      originalText,
      versionIds,
      commentaries,
      ...commentarySections
    ] = await Promise.all([
      readResource<BibleChapterDto>(`/v1/bibles/${version.id}${chapterPath}`),
      presentation === 'strong' || presentation === 'reverse-interlinear'
        ? readResource<StrongBibleChapterDto>(`/v1/strong-bibles/${version.id}${chapterPath}`)
        : undefined,
      aligned
        ? readResource<InterlinearBibleChapterDto>(
            `/v1/interlinear-bibles/${INTERLINEAR_VERSION_ID}/languages/${language}${chapterPath}`
          )
        : undefined,
      // The reverse interlinear quotes the original forms from the original-language Bible.
      presentation === 'reverse-interlinear'
        ? readResource<BibleChapterDto>(`/v1/bibles/${INTERLINEAR_VERSION_ID}${chapterPath}`)
        : undefined,
      listVersionsCarrying(book, chapter, lastVerse),
      listCommentaryLinks(language, { book, chapter }),
      // A commentary that says nothing here, or cannot be read, leaves the text as it is.
      ...inlineCommentaries.map(commentary =>
        readCommentarySections(commentary, language, { book, chapter }).catch(() => [])
      ),
    ])
    if (!text) throw notFound()

    const selected = passage
      ? text.verses.filter(
          verse => verse.number >= passage.startVerse && verse.number <= (lastVerse ?? 0)
        )
      : text.verses
    if (
      passage &&
      (!selected.some(verse => verse.number === passage.startVerse) ||
        !selected.some(verse => verse.number === lastVerse))
    ) {
      throw notFound()
    }

    const spansByVerse = versesByNumber(strong?.verses)
    const tokensByVerse = versesByNumber(interlinear?.verses)
    const originalTextByVerse = versesByNumber(originalText?.verses)
    const originals = new Map<number, OriginalToken>(
      (interlinear?.verses ?? []).flatMap(verse => {
        const verseText = originalTextByVerse.get(verse.number)?.text ?? ''
        return verse.tokens.map(
          token =>
            [
              token.id,
              {
                form: verseText.slice(token.startOffset, token.startOffset + token.length),
                transliteration: token.segments.map(segment => segment.transliteration).join(''),
              },
            ] as const
        )
      })
    )

    const comments = inlineCommentaries.flatMap((commentary, index) =>
      (commentarySections[index] ?? []).flatMap((section): InlineComment[] => {
        const excerpt = commentaryExcerpt(
          renderCommentaryHtml(section.content, { language }),
          COMMENT_EXCERPT_LENGTH
        )
        return excerpt
          ? [
              {
                commentary: commentary.id,
                title: commentary.title,
                section: section.slug,
                startVerse: section.startVerse,
                endVerse: section.endVerse,
                path: buildCommentarySectionPath(
                  { language, resource: commentary.id, book, chapter },
                  section.slug
                ),
                excerpt,
              },
            ]
          : []
      })
    )
    const commentsByVerse = new Map(
      [...placeCommentarySections(comments, selected.map(verse => verse.number))].map(
        ([verse, placed]) => [verse, renderInlineComments(placed, language)]
      )
    )

    const location = { versionId: version.id, presentation, book, chapter, gloss }
    const all = orderedChapters(coverage)
    const index = all.findIndex(ref => ref.book === book && ref.chapter === chapter)

    return {
      versionId: version.id,
      presentation,
      language,
      book,
      chapter,
      passage,
      gloss,
      ...(aligned
        ? {
            commentsBeforeHtml: commentsByVerse.get(0),
            verses: selected.map(verse => ({
              number: verse.number,
              commentsHtml: commentsByVerse.get(verse.number),
              // A passage is quoted on its own; section titles belong to the chapter reading.
              headings: passage ? [] : verse.presentation.headings.map(heading => heading.text),
              words:
                presentation === 'interlinear'
                  ? directInterlinearWords(
                      verse.text,
                      tokensByVerse.get(verse.number)?.tokens ?? [],
                      language
                    )
                  : reverseInterlinearWords(
                      verse.text,
                      spansByVerse.get(verse.number)?.spans ?? [],
                      originals,
                      language
                    ),
            })),
          }
        : renderBibleText(selected, {
            blocksAfterVerse: commentsByVerse,
            verseHref: verse =>
              withInlineCommentaries(
                buildBiblePath({ ...location, passage: { startVerse: verse } }),
                commentaryChoice
              ),
            verseLabel: verse => `${bibleBookName(book, language)} ${chapter}:${verse}`,
            // A cross-reference stays in the version being read, when it carries the passage.
            referenceHref: osisReference => {
              const reference = parseOsisReference(osisReference)
              if (!reference?.chapter) return undefined
              if (!coverage.chaptersByBook[String(reference.book)]?.includes(reference.chapter)) {
                return undefined
              }
              return buildBiblePath({
                versionId: version.id,
                book: reference.book,
                chapter: reference.chapter,
                passage:
                  reference.verse === undefined
                    ? undefined
                    : { startVerse: reference.verse, endVerse: reference.endVerse },
              })
            },
            includeHeadings: !passage,
            // The Strong presentation prints the Strong numbers of every tagged word.
            markersByVerse:
              presentation === 'strong'
                ? new Map(
                    [...spansByVerse].map(([verse, { spans }]) => [
                      verse,
                      spans.map((span): BibleTextMarker => ({
                        offset: span.startOffset + span.length,
                        html: strongReferencesHtml(
                          bibleStrongLinks(span.identities, language),
                          span.length === 0
                        ),
                      })),
                    ])
                  )
                : undefined,
          })),
      books: coverage.canon.orderedBooks
        .filter(orderedBook => coverage.books.includes(orderedBook))
        .map(orderedBook => ({
          book: orderedBook,
          chapters: coverage.chaptersByBook[String(orderedBook)]?.length ?? 0,
        })),
      versionIds,
      commentaries,
      commentaryChoice,
      inlineCommentaries: inlineCommentaries.map(({ id, title }) => ({ id, title })),
      previous: index > 0 ? all[index - 1] : undefined,
      next: index >= 0 ? all[index + 1] : undefined,
      description: truncateText(
        `${bibleBookName(book, language)} ${chapter}${
          passage ? `:${passage.startVerse}${passage.endVerse ? `-${passage.endVerse}` : ''}` : ''
        } (${version.id}) — ${selected.map(verse => verse.text).join(' ')}`,
        DESCRIPTION_LENGTH
      ),
    }
  })
