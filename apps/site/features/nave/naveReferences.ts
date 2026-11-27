import {
  bibleVersification,
  compareVerseRefs,
  convertRange,
  convertVerseKeyToOne,
  lastVerseOfChapter,
  parseVerseKey,
  RESOURCE_VERSIFICATIONS,
  versesOfRange,
  type VerseRef,
  type VersificationId,
} from '@bible-strong/resource-domain/versification'
import { bibleBookName, bibleBookSlug } from '../bible/bibleBooks'
import { defaultBibleVersionId } from '../bible/bibleVersions'
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

type Numberings = { from: VersificationId; to: VersificationId }

/**
 * The verses of `to` a run of verses of `from` covers. A run opens at the verse that stands
 * for its first one, a Psalm title left out (Nave Ps 51:1-2 is LSG 51:3-4); a whole chapter
 * keeps everything it covers. Undefined when no verse of the run is in the numbering's table,
 * and the run is then kept as written.
 */
const convertRun = (
  { from, to }: Numberings,
  book: number,
  chapter: number,
  { start, end }: NaveVerseRun,
  wholeChapter: boolean
): VerseRef[] | undefined => {
  const source = { start: { book, chapter, verse: start }, end: { book, chapter, verse: end } }
  if (!versesOfRange(from, source).length) return undefined
  const range = convertRange(from, to, source)
  if (!range) return []
  const first = wholeChapter
    ? undefined
    : parseVerseKey(convertVerseKeyToOne(`${book}-${chapter}-${start}`, from, to) ?? '')
  const opening =
    first && compareVerseRefs(first, range.start) > 0 && compareVerseRefs(first, range.end) <= 0
      ? first
      : range.start
  return versesOfRange(to, { start: opening, end: range.end })
}

/**
 * A reference of a topic, written in the Nave's numbering (the KJV's), in the numbering of the
 * Bible the page quotes and links to, that of the page language by default: one reference per
 * chapter it falls in (KJV Numbers 16:36-50 is LSG 17:1-15), none when no cited verse has an
 * equivalent there. A whole chapter stays one when its verses fill a chapter of the Bible
 * (Nave Joel 3 is LSG Joel 4), else it becomes the verses it covers (Nave Malachi 4 is LSG
 * Malachi 3:19-24). An unknown numbering leaves the reference as written.
 */
export const naveReferenceInBible = (
  reference: NaveVerseReference,
  language: ResourceLanguage,
  versionId = defaultBibleVersionId(language)
): NaveVerseReference[] => {
  const from = RESOURCE_VERSIFICATIONS[`nave:${language}`]
  const to = bibleVersification(versionId)
  if (!from || !to || from === to) return [reference]
  const { book, chapter, verses } = reference
  const wholeChapter = verses.length === 0
  const runs = wholeChapter
    ? [{ start: 1, end: lastVerseOfChapter(from, book, chapter) ?? 1 }]
    : naveVerseRuns(verses)

  const byChapter = new Map<number, number[]>()
  const add = (refChapter: number, verse?: number) => {
    const list = byChapter.get(refChapter) ?? []
    if (verse !== undefined && !list.includes(verse)) list.push(verse)
    byChapter.set(refChapter, list)
  }
  for (const run of runs) {
    const converted = convertRun({ from, to }, book, chapter, run, wholeChapter)
    if (!converted) {
      // A verse the table does not know is read as written, as before conversion.
      if (wholeChapter) add(chapter)
      else for (let verse = run.start; verse <= run.end; verse++) add(chapter, verse)
      continue
    }
    for (const ref of converted) add(ref.chapter, ref.verse)
  }

  return [...byChapter].map(([refChapter, list]) => {
    const last = lastVerseOfChapter(to, book, refChapter)
    const fillsChapter =
      wholeChapter &&
      (list.length === 0 ||
        (last !== undefined &&
          Array.from({ length: last }, (_, index) => index + 1).every(verse =>
            list.includes(verse)
          )))
    return { book, chapter: refChapter, verses: fillsChapter ? [] : list }
  })
}

/** How many verses a topic page quotes in full; the outline cites them all. */
export const NAVE_QUOTED_VERSE_COUNT = 40

/**
 * The verses a topic page quotes: the first ones its outline cites, each once, in the order
 * it cites them. A reference to a whole chapter names no verse to quote.
 */
export const naveQuotedVerses = (
  references: readonly NaveVerseReference[],
  limit = NAVE_QUOTED_VERSE_COUNT
): { book: number; chapter: number; verse: number }[] => {
  const seen = new Set<string>()
  const verses: { book: number; chapter: number; verse: number }[] = []
  for (const { book, chapter, verses: cited } of references) {
    for (const verse of cited) {
      const key = `${book}-${chapter}-${verse}`
      if (seen.has(key)) continue
      seen.add(key)
      verses.push({ book, chapter, verse })
      if (verses.length === limit) return verses
    }
  }
  return verses
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
 * Resolves the two link schemes of a topic to site pages: `v=book-chapter-verses`, already in
 * that Bible's numbering (`naveReferenceInBible`), to the Bible of the page language and `w=normalizedName` to another topic. A verse list opens
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
