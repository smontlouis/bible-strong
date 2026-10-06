import { isCommentaryResourceSlug } from '../commentary/commentaryRoutes'
import { escapeHtml } from '../resources/editorialHtml'
import type { ResourceLanguage } from '../resources/publicSite'

// A reader may show commentaries inside the Bible text. The choice is written in the address
// of the page (`?commentary=barnes.mhy-fr`) and follows the reader from chapter to chapter.

/** How many commentaries are shown in the text at once. */
export const MAX_INLINE_COMMENTARIES = 5

// A dot is neither part of a commentary identity nor escaped in a query string.
const SEPARATOR = '.'

export type BibleSearch = { commentary?: string }

/**
 * The commentaries a query-string value names: each once, in alphabetical order so that a
 * choice has one spelling, at most five. A form without scripting sends one value per
 * checked box. Whether a name is a commentary of the page is for the page to tell: the
 * catalog is not loaded where an address is read.
 */
export const parseInlineCommentaries = (value: unknown): string[] => {
  const named = (Array.isArray(value) ? value : [value]).flatMap(item =>
    typeof item === 'string' ? item.split(/[.,]/u) : []
  )
  return [...new Set(named.filter(isCommentaryResourceSlug))]
    .sort()
    .slice(0, MAX_INLINE_COMMENTARIES)
}

export const serializeInlineCommentaries = (ids: readonly string[]): string | undefined =>
  ids.length ? ids.join(SEPARATOR) : undefined

/** The search of a Bible page in its one spelling; anything else is left out. */
export const validateBibleSearch = (search: Record<string, unknown>): BibleSearch => {
  const commentary = serializeInlineCommentaries(parseInlineCommentaries(search.commentary))
  return commentary ? { commentary } : {}
}

/** A Bible path that keeps the commentaries shown in the text. */
export const withInlineCommentaries = (path: string, ids: readonly string[]): string => {
  const commentary = serializeInlineCommentaries(ids)
  if (!commentary) return path
  const [address, hash] = path.split('#')
  return `${address}?commentary=${commentary}${hash === undefined ? '' : `#${hash}`}`
}

type VerseRun = { startVerse: number; endVerse: number }

/**
 * Where the comments of a chapter are read in the verses shown: each after the last verse it
 * comments, and the introduction of the chapter (verse 0) before the first verse. A comment
 * on verses that are not shown is left out.
 */
export const placeCommentarySections = <Section extends VerseRun>(
  sections: readonly Section[],
  verses: readonly number[]
): Map<number, Section[]> => {
  const placed = new Map<number, Section[]>()
  const place = (verse: number, section: Section) =>
    placed.set(verse, [...(placed.get(verse) ?? []), section])
  for (const section of sections) {
    if (section.endVerse === 0) {
      // An introduction opens the chapter, not a passage quoted from the middle of it.
      if (verses[0] === 1) place(0, section)
      continue
    }
    const commented = verses.filter(
      verse => verse >= section.startVerse && verse <= section.endVerse
    )
    const last = commented.at(-1)
    if (last !== undefined) place(last, section)
  }
  return placed
}

/** One comment shown in the text: where it comes from and how it begins. */
export type InlineComment = VerseRun & {
  /** The Resource identity of the commentary. */
  commentary: string
  title: string
  /** The section of the commentary, which names it in the route grammar. */
  section: string
  /** The address of the section in its commentary. */
  path: string
  excerpt: string
}

const INTRODUCTION: Record<ResourceLanguage, string> = { fr: 'Introduction', en: 'Introduction' }

/** `v. 16`, `v. 16-18`, or the introduction of the chapter. */
export const commentVersesLabel = (
  { startVerse, endVerse }: VerseRun,
  language: ResourceLanguage
): string => {
  if (endVerse === 0) return INTRODUCTION[language]
  const first = Math.max(startVerse, 1)
  return first === endVerse ? `v. ${endVerse}` : `v. ${first}-${endVerse}`
}

/**
 * The comments read at one place of the text. Each is a plain link to its section in the
 * commentary; with scripting, a click opens the comment over the passage instead.
 */
export const renderInlineComments = (
  comments: readonly InlineComment[],
  language: ResourceLanguage
): string =>
  `<div class="bible-comments" lang="${language}">${comments
    .map(
      comment =>
        `<a class="bible-comment" href="${escapeHtml(comment.path)}" data-commentary="${escapeHtml(
          comment.commentary
        )}" data-section="${escapeHtml(comment.section)}"><span class="bible-comment__source">${escapeHtml(
          comment.title
        )} · ${escapeHtml(commentVersesLabel(comment, language))}</span><span class="bible-comment__excerpt">${escapeHtml(
          comment.excerpt
        )}</span></a>`
    )
    .join('')}</div>`
