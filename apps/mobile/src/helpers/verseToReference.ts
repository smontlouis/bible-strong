import { getBook } from '~helpers/bibleBookCatalog'
import i18n from '~i18n'

/** Verse ID format: "book-chapter-verse" (e.g., "1-1-1") */
type VerseId = string

/** Plan format: "book|chapter:startVerse-endVerse" (e.g., "1|1:1-5") */
type PlanVerse = string

/** Book/chapter with optional verses */
interface BookChapterInput {
  bookNum: number
  chapterNum: number
  verses?: (string | number)[]
}

/** Input can be a single verse, array of verses, object with verse keys, or book/chapter */
type VerseInput =
  | VerseId
  | VerseId[]
  | Record<VerseId, boolean>
  | PlanVerse
  | BookChapterInput
  | undefined

interface VerseToReferenceOptions {
  isPlan?: boolean
}

interface ParsedVerse {
  book: number
  chapter: number
  verse: number
}

const isBookChapterInput = (v: VerseInput): v is BookChapterInput => {
  return typeof v === 'object' && !Array.isArray(v) && 'bookNum' in v && 'chapterNum' in v
}

const parseVerseId = (verseId: VerseId): ParsedVerse => {
  const [book, chapter, verse] = verseId.split('-').map(Number)
  return { book, chapter, verse }
}

const orderVerses = (arrayVerses: VerseId[]): VerseId[] => {
  return arrayVerses.sort((key1, key2) => {
    const verse1 = parseVerseId(key1)
    const verse2 = parseVerseId(key2)
    return (
      verse1.book - verse2.book || verse1.chapter - verse2.chapter || verse1.verse - verse2.verse
    )
  })
}

const compactVerseNumbers = (verses: number[]): string =>
  verses.reduce((acc: string, verse: number, i: number, array: number[]) => {
    if (verse === array[i - 1] + 1 && verse === array[i + 1] - 1) {
      return acc
    }
    if (verse === array[i - 1] + 1 && verse !== array[i + 1] - 1) {
      return `${acc}-${verse}`
    }
    if (array[i - 1] && verse - 1 !== array[i - 1]) {
      return `${acc},${verse}`
    }
    return acc + verse
  }, '')

const range = (start: number, end: number): number[] => {
  return Array(end - start + 1)
    .fill(0)
    .map((_, idx) => start + idx)
}

// Examples:
// "1-1-1" => "Genèse 1:1"
// ["1-1-1", "1-1-3", "1-1-4", "1-1-5"] => "Genèse 1:1,3-5"
// {"1-1-1": true, "1-1-2": true} => "Genèse 1:1-2"
// { bookNum: 1, chapterNum: 1, verses: [1, 3, 4, 5] } => "Genèse 1:1,3-5"
// { bookNum: 1, chapterNum: 1 } => "Genèse 1"
const verseToReference = (v: VerseInput, options: VerseToReferenceOptions = {}): string => {
  if (
    !v ||
    (typeof v === 'object' && !Array.isArray(v) && !isBookChapterInput(v) && !Object.keys(v).length)
  )
    return ''

  let verses: VerseId[]

  // Handle BookChapterInput
  if (isBookChapterInput(v)) {
    const { bookNum, chapterNum, verses: inputVerses } = v
    const bookName = getBook(bookNum)?.Nom
    const translatedBookName = bookName
      ? i18n.t(bookName)
      : i18n.t('Livre {{bookNumber}}', { bookNumber: bookNum })
    // If no verses, return just book and chapter
    if (!inputVerses || !inputVerses.length) {
      return `${translatedBookName} ${chapterNum}`
    }
    verses = inputVerses.map(verse => `${bookNum}-${chapterNum}-${verse}`)
  }
  // Special extraction for plan format
  else if (options.isPlan && typeof v === 'string') {
    const [book, rest] = v.split('|')
    const [chapter, numberRange] = rest.split(':')
    const [startVerse, endVerse] = numberRange.split('-').map(Number)
    verses = endVerse
      ? range(startVerse, endVerse).map(n => `${book}-${chapter}-${n}`)
      : [`${book}-${chapter}-${startVerse}`]
  } else if (typeof v === 'object' && !Array.isArray(v)) {
    verses = Object.keys(v)
  } else if (typeof v === 'string') {
    verses = [v]
  } else {
    verses = v
  }

  if (!verses.length) {
    return ''
  }

  verses = orderVerses(verses)

  const parsedVerses: ParsedVerse[] = verses.map(parseVerseId)
  const groupedByChapter = parsedVerses.reduce(
    (groups, verse) => {
      const key = `${verse.book}-${verse.chapter}`
      groups[key] = groups[key] || {
        book: verse.book,
        chapter: verse.chapter,
        verses: [],
      }
      groups[key].verses.push(verse.verse)
      return groups
    },
    {} as Record<string, { book: number; chapter: number; verses: number[] }>
  )

  return Object.values(groupedByChapter)
    .map(group => {
      const bookName = getBook(group.book)?.Nom
      const translatedBookName = bookName
        ? i18n.t(bookName)
        : i18n.t('Livre {{bookNumber}}', { bookNumber: group.book })
      return `${translatedBookName} ${group.chapter}:${compactVerseNumbers(group.verses)}`
    })
    .join('; ')
}

export default verseToReference
