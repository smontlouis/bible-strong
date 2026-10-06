import { bibleBookName, bibleBookSlug } from '../bible/bibleBooks'
import type { ResourceLanguage } from '../resources/publicSite'

/** A verse or a span of verses within one chapter. */
export type TimelinePassage = { book: number; chapter: number; verse: number; endVerse?: number }

const passage = (
  book: number,
  chapter: number,
  verse: number,
  endVerse?: number
): TimelinePassage => ({
  book,
  chapter,
  verse,
  ...(endVerse !== undefined && endVerse > verse ? { endVerse } : {}),
})

/**
 * Reads `book|chapter:verse[-verse]`, the passage format of the publication. Any other
 * shape (`1|43|2:1`) is left unread rather than guessed.
 */
export const parseTimelineScripture = (value: string): TimelinePassage | undefined => {
  const match = /^(\d{1,2})\|(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/u.exec(value.trim())
  if (!match) return undefined
  const book = Number(match[1])
  const chapter = Number(match[2])
  const verse = Number(match[3])
  if (!bibleBookSlug(book) || !chapter || !verse) return undefined
  return passage(book, chapter, verse, match[4] === undefined ? undefined : Number(match[4]))
}

/** The passages of an event, each once, in the order the publication cites them. */
export const listTimelinePassages = (scriptures: readonly string[]): TimelinePassage[] => {
  const passages = new Map<string, TimelinePassage>()
  for (const scripture of scriptures) {
    const parsed = parseTimelineScripture(scripture)
    if (!parsed) continue
    const { book, chapter, verse, endVerse = verse } = parsed
    const key = `${book}-${chapter}-${verse}-${endVerse}`
    if (!passages.has(key)) passages.set(key, parsed)
  }
  return [...passages.values()]
}

/**
 * Fits a passage to the Bible it opens in. The publication follows the English verse
 * numbering and Bibles differ: a passage starting beyond its chapter has no page there,
 * and a span is cut at the last verse of the chapter.
 */
export const fitTimelinePassage = (
  { book, chapter, verse, endVerse }: TimelinePassage,
  verseCount: number | undefined
): TimelinePassage | undefined => {
  if (!verseCount || verse > verseCount) return undefined
  return passage(
    book,
    chapter,
    verse,
    endVerse === undefined ? undefined : Math.min(endVerse, verseCount)
  )
}

/** `Genèse 2:7` or `Genesis 7:1-6`, as Bible pages write their references. */
export const timelinePassageLabel = (
  { book, chapter, verse, endVerse }: TimelinePassage,
  language: ResourceLanguage
): string =>
  `${bibleBookName(book, language)} ${chapter}:${verse}${endVerse === undefined ? '' : `-${endVerse}`}`

// As in the study workspace, a passage is introduced by its first verses.
const EXCERPT_VERSE_COUNT = 3

/** The verses quoted under a passage: its first ones. */
export const timelineExcerptVerses = ({ verse, endVerse = verse }: TimelinePassage): number[] =>
  Array.from(
    { length: Math.min(endVerse - verse + 1, EXCERPT_VERSE_COUNT) },
    (_, index) => verse + index
  )
