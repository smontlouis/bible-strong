import {
  getSupportedOsisBookId,
  getSupportedOsisBookNumber,
} from '@bible-strong/bible-reference-parser/osis-reference'
import {
  createBibleReferenceParser,
  type BibleReferenceParser,
} from '@bible-strong/bible-reference-parser/reference-parser'
import type { StudyLanguage } from '../language'
import { bookName } from './books'

/** Verses of one chapter, both ends included. */
export type Passage = {
  book: number
  chapter: number
  startVerse: number
  endVerse: number
  /** The reference named the chapter, not verses of it. */
  wholeChapter: boolean
}

export type VerseLocation = { book: number; chapter: number; verse: number }

const parsers = new Map<StudyLanguage, BibleReferenceParser>()

// A parser reads the book names of one language; each is built when first needed.
const parserFor = (language: StudyLanguage): BibleReferenceParser => {
  const known = parsers.get(language)
  if (known) return known
  const parser = createBibleReferenceParser(language)
  parsers.set(language, parser)
  return parser
}

type OsisPoint = { osisBook: string; book: number; chapter: number; verse?: number }

const parseOsisPoint = (value: string | undefined): OsisPoint | undefined => {
  const [osisBook, chapter, verse] = (value ?? '').split('.')
  const book = osisBook ? getSupportedOsisBookNumber(osisBook) : undefined
  if (!osisBook || !book || !Number(chapter)) return undefined
  return { osisBook, book, chapter: Number(chapter), ...(verse ? { verse: Number(verse) } : {}) }
}

const passagesFromOsis = (osis: string, parser: BibleReferenceParser): Passage[] =>
  osis.split(',').flatMap(segment => {
    const [startRef, endRef] = segment.split('-')
    const start = parseOsisPoint(startRef)
    const end = endRef ? parseOsisPoint(endRef) : start
    // A range across two books has no single reading.
    if (!start || !end || start.book !== end.book) return []
    const passages: Passage[] = []
    for (let chapter = start.chapter; chapter <= end.chapter; chapter += 1) {
      const startVerse = chapter === start.chapter ? (start.verse ?? 1) : 1
      const endVerse =
        chapter === end.chapter && end.verse
          ? end.verse
          : parser.lastVerse(start.osisBook, chapter)
      if (!endVerse || startVerse > endVerse) continue
      passages.push({
        book: start.book,
        chapter,
        startVerse,
        endVerse,
        wholeChapter:
          (chapter !== start.chapter || !start.verse) && (chapter !== end.chapter || !end.verse),
      })
    }
    return passages
  })

// What links inside the resources name a passage by: `John.3.16`, `Gen.1.1-Gen.2.3`.
const OSIS_INPUT_PATTERN = /^[1-3]?[A-Za-z]+\.\d+(?:\.\d+)?(?:-(?:[1-3]?[A-Za-z]+\.)?\d+(?:\.\d+)?)?(?:,|$)/u

/** Rewrites `John.3.16-18` as `John.3.16-John.3.18`, the only spelling the parser gives. */
const expandOsisSegment = (segment: string): string => {
  const [start, end] = segment.split('-')
  if (!end || /^[1-3]?[A-Za-z]/u.test(end)) return segment
  const parts = (start ?? '').split('.')
  const tail = end.split('.')
  if (parts.length === 3 && tail.length === 1) return `${start}-${parts[0]}.${parts[1]}.${end}`
  if (parts.length === 3 && tail.length === 2) return `${start}-${parts[0]}.${end}`
  if (parts.length === 2 && tail.length === 1) return `${start}-${parts[0]}.${end}`
  return segment
}

/**
 * Reads a reference as people write it (« Jean 3:16-18 », “1 Cor 13”, “Gen 1:1-2:3”) or as
 * the resources link it (`John.3.16`). Book names are read in the language given first,
 * then in the other one. Nothing is returned when no passage is recognized.
 */
export const parsePassages = (text: string, language: StudyLanguage): Passage[] => {
  const input = text.trim()
  if (!input) return []
  const languages: StudyLanguage[] = language === 'fr' ? ['fr', 'en'] : ['en', 'fr']
  if (OSIS_INPUT_PATTERN.test(input)) {
    const osis = input.split(',').map(expandOsisSegment).join(',')
    const passages = passagesFromOsis(osis, parserFor(language))
    if (passages.length) return passages
  }
  for (const candidate of languages) {
    const parser = parserFor(candidate)
    const passages = passagesFromOsis(parser.parse(input).osis(), parser)
    if (passages.length) return passages
  }
  return []
}

/** What one reading of a passage holds: chapters, and verses in all. */
export const MAX_READING_CHAPTERS = 6
export const MAX_READING_VERSES = 200

/** A passage written in a sentence: where it stands, how tools read it back, its name. */
export type WrittenReference = { start: number; end: number; osis: string; label: string }

// The book a reference opens with, after the number some books bear: « 1 Co », "II Tim.".
const WRITTEN_BOOK = /^([1-3]\s?|I{1,3}\s)?(\p{L}+)/u
// A book and its chapter as resources spell them for machines: "1Ki.18", "Gen.14".
const DOTTED_CHAPTER = /^[1-3]?\p{L}{2,}\.\d/u
// A book of two letters with its numbers right after it: « Ge 14:18 », never « Le verset 1 ».
const SHORT_BOOK = /^(?:[1-3]\s?|I{1,3}\s)?\p{L}{1,2}[^\p{L}\d]*\d/u

/**
 * Finds the passages written in a sentence: « voir Ge 14:18-20 ; Hé 7:1, 3 ». Resources
 * name books in their language and, here and there, in the other one: both are read.
 *
 * What reads as a reference by chance is left as text. A book is written with a capital.
 * A chapter given alone is kept when its book is unlikely to be a word, a numbered book or
 * a name of three letters or more in the language of the text, or when it is spelled as
 * for a machine; and when nothing follows that the parser could not read. A book of two
 * letters is followed by its numbers, not by a word. « La 3 », « Le verset 1 », "Is 5" and
 * "Psa.81(82):6" stay as they are.
 */
export const findReferences = (text: string, language: StudyLanguage): WrittenReference[] => {
  // No passage is written without a number.
  if (!/\d/u.test(text)) return []
  const found: WrittenReference[] = []
  const languages: StudyLanguage[] = language === 'fr' ? ['fr', 'en'] : ['en', 'fr']
  for (const candidate of languages) {
    const parser = parserFor(candidate)
    // A number alone goes on from the reference before it: it is kept when that one was.
    let previousKept = false
    for (const match of parser.parse(text).osis_and_indices()) {
      const [start = 0, matchEnd = 0] = match.indices
      // « 6:33 a vécu »: the word after a verse is not the half of it.
      const end = /\d\s\p{L}$/u.test(text.slice(start, matchEnd)) ? matchEnd - 2 : matchEnd
      const written = text.slice(start, end)
      const reference = (): WrittenReference | undefined => {
        const passages = passagesFromOsis(match.osis, parser)
        const first = passages[0]
        if (!first) return undefined
        const [, numbered, book] = WRITTEN_BOOK.exec(written) ?? []
        if (!book) {
          if (!previousKept) return undefined
        } else {
          if (book[0] === book[0]!.toLowerCase()) return undefined
          if (book.length < 3 && !SHORT_BOOK.test(written)) return undefined
          if (first.wholeChapter) {
            const named = candidate === language && (numbered || book.length >= 3)
            if (!named && !DOTTED_CHAPTER.test(written)) return undefined
            if (/^\s?[([:]/u.test(text.slice(end, end + 2))) return undefined
          }
        }
        // A passage longer than one reading opens at its first chapter.
        const readable =
          passages.length <= MAX_READING_CHAPTERS && verseCount(passages) <= MAX_READING_VERSES
        return {
          start,
          end,
          osis: (readable ? passages : [first]).map(passageOsis).join(','),
          // A number alone is named in full; a reference with its book is its own name.
          label: book ? written : formatPassages(passages, language),
        }
      }
      // What the first language read is not read again.
      if (found.some(other => start < other.end && other.start < end)) {
        previousKept = true
        continue
      }
      const kept = reference()
      if (kept) found.push(kept)
      previousKept = Boolean(kept)
    }
  }
  return found.sort((left, right) => left.start - right.start)
}

/** The single verse a reference names, or the first one of the passage it names. */
export const parseVerse = (text: string, language: StudyLanguage): VerseLocation | undefined => {
  const passage = parsePassages(text, language)[0]
  return passage && { book: passage.book, chapter: passage.chapter, verse: passage.startVerse }
}

/** How the Resource API names a verse. */
export const verseKey = ({ book, chapter, verse }: VerseLocation): string =>
  `${book}-${chapter}-${verse}`

export const parseVerseKey = (value: string): VerseLocation | undefined => {
  const match = /^(\d+)-(\d+)-(\d+)$/u.exec(value)
  if (!match) return undefined
  const [book, chapter, verse] = [Number(match[1]), Number(match[2]), Number(match[3])]
  return book && chapter && verse ? { book, chapter, verse } : undefined
}

/** A reference as a page prints it: « Jean 3:16 », « Jean 3:16-18 », « Jean 3 ». */
export const formatPassage = (passage: Passage, language: StudyLanguage): string => {
  const head = `${bookName(passage.book, language)} ${passage.chapter}`
  if (passage.wholeChapter) return head
  return passage.startVerse === passage.endVerse
    ? `${head}:${passage.startVerse}`
    : `${head}:${passage.startVerse}-${passage.endVerse}`
}

export const formatVerse = (verse: VerseLocation, language: StudyLanguage): string =>
  `${bookName(verse.book, language)} ${verse.chapter}:${verse.verse}`

/** Passages read in a row: « Jean 3:16-18 ; Romains 8:28 ». */
export const formatPassages = (passages: readonly Passage[], language: StudyLanguage): string =>
  passages.map(passage => formatPassage(passage, language)).join(language === 'fr' ? ' ; ' : '; ')

/** The OSIS spelling of a passage, which every tool reads back: `John.3.16-John.3.18`. */
export const passageOsis = (passage: Passage): string => {
  const book = getSupportedOsisBookId(passage.book) ?? String(passage.book)
  const chapter = `${book}.${passage.chapter}`
  if (passage.wholeChapter) return chapter
  return passage.startVerse === passage.endVerse
    ? `${chapter}.${passage.startVerse}`
    : `${chapter}.${passage.startVerse}-${chapter}.${passage.endVerse}`
}

export const verseOsis = ({ book, chapter, verse }: VerseLocation): string =>
  `${getSupportedOsisBookId(book) ?? book}.${chapter}.${verse}`

export const verseCount = (passages: readonly Passage[]): number =>
  passages.reduce((total, passage) => total + passage.endVerse - passage.startVerse + 1, 0)
