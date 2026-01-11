import books from '~assets/bible_versions/books-desc'
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

const orderVerses = (arrayVerses: VerseId[]): VerseId[] => {
  return arrayVerses.sort((key1, key2) => {
    const verse1 = Number(key1.split('-')[2])
    const verse2 = Number(key2.split('-')[2])
    return verse1 - verse2
  })
}

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
    const bookName = books[bookNum - 1].Nom
    // If no verses, return just book and chapter
    if (!inputVerses || !inputVerses.length) {
      return `${i18n.t(bookName)} ${chapterNum}`
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

  const parsedVerses: ParsedVerse[] = verses.map(verseId => {
    const [book, chapter, verse] = verseId.split('-').map(Number)
    return { book, chapter, verse }
  })

  const title: string = parsedVerses
    .map(v => v.verse)
    .reduce(
      (acc: string, verse: number, i: number, array: number[]) => {
        if (verse === array[i - 1] + 1 && verse === array[i + 1] - 1) {
          // if suite > 2
          return acc
        }
        if (verse === array[i - 1] + 1 && verse !== array[i + 1] - 1) {
          // if endSuite
          return `${acc}-${verse}`
        }
        if (array[i - 1] && verse - 1 !== array[i - 1]) {
          // if not preceded by - 1
          return `${acc},${verse}`
        }
        return acc + verse
      },
      `${i18n.t(books[parsedVerses[0].book - 1].Nom)} ${parsedVerses[0].chapter}:`
    )

  return title
}

export default verseToReference
