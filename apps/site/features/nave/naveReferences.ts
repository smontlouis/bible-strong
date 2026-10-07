import { bibleBookName, bibleBookSlug } from '../bible/bibleBooks'
import { buildBibleReferencePath } from '../resources/editorialLinks'
import type { ResourceLanguage } from '../resources/publicSite'
import { buildNavePath, parseNaveTopic } from './naveRoutes'

/** A chapter, or the verses of that chapter a topic cites, in the order it cites them. */
export type NaveVerseReference = { book: number; chapter: number; verses: number[] }

/** Consecutive verses, both ends included. */
export type NaveVerseRun = { start: number; end: number }

/**
 * Reads the target of a verse link: `book-chapter` for a whole chapter, or
 * `book-chapter-verse,verse,…` where every cited verse is listed.
 */
export const parseNaveVerseTarget = (target: string): NaveVerseReference | undefined => {
  const match = /^(\d{1,2})-(\d{1,3})(?:-(\d{1,3}(?:,\d{1,3})*))?$/u.exec(target.trim())
  if (!match) return undefined
  const book = Number(match[1])
  const chapter = Number(match[2])
  const verses = match[3]?.split(',').map(Number) ?? []
  // Only a book the site reads can be named and linked.
  if (!bibleBookSlug(book) || !chapter || verses.includes(0)) return undefined
  return { book, chapter, verses }
}

/** Groups cited verses into runs of consecutive numbers, keeping their order. */
export const naveVerseRuns = (verses: readonly number[]): NaveVerseRun[] => {
  const runs: NaveVerseRun[] = []
  for (const verse of verses) {
    const last = runs.at(-1)
    if (last && verse === last.end + 1) last.end = verse
    else runs.push({ start: verse, end: verse })
  }
  return runs
}

const runLabel = ({ start, end }: NaveVerseRun): string =>
  start === end ? String(start) : `${start}-${end}`

/**
 * A reference as links: a Bible page shows one passage, so each run of consecutive verses
 * opens its own. The first label carries the book, in the page language, and the chapter;
 * the following ones only their verses, so the labels read in a row as `Exode 6:13,26-27`.
 */
export const naveReferenceLinks = (
  reference: NaveVerseReference,
  language: ResourceLanguage
): { label: string; target: string }[] => {
  const { book, chapter, verses } = reference
  const head = `${bibleBookName(book, language)} ${chapter}`
  const runs = naveVerseRuns(verses)
  if (!runs.length) return [{ label: head, target: `${book}-${chapter}` }]
  return runs.map((run, index) => ({
    label: index === 0 ? `${head}:${runLabel(run)}` : runLabel(run),
    target: `${book}-${chapter}-${Array.from(
      { length: run.end - run.start + 1 },
      (_, offset) => run.start + offset
    ).join(',')}`,
  }))
}

export type NaveLinkContext = {
  language: ResourceLanguage
  /** Whether the publication of that language holds a topic. */
  hasTopic: (normalizedName: string) => boolean
}

/**
 * Resolves the two link schemes of a topic to site pages: `v=book-chapter-verses` to the
 * Bible of the page language and `w=normalizedName` to another topic. A verse list opens
 * at its first run of consecutive verses. Anything else, or a topic the publication does
 * not hold, is left unresolved.
 */
export const resolveNaveHref = (
  href: string,
  { language, hasTopic }: NaveLinkContext
): string | undefined => {
  const separator = href.indexOf('=')
  const scheme = href.slice(0, separator)
  const target = href.slice(separator + 1)
  if (scheme === 'v') {
    const reference = parseNaveVerseTarget(target)
    if (!reference) return undefined
    const run = naveVerseRuns(reference.verses)[0]
    return buildBibleReferencePath(language, {
      book: reference.book,
      chapter: reference.chapter,
      verse: run?.start,
      endVerse: run && run.end > run.start ? run.end : undefined,
    })
  }
  if (scheme === 'w') {
    const topic = parseNaveTopic(target)
    return topic && hasTopic(topic) ? buildNavePath(language, topic) : undefined
  }
  return undefined
}
