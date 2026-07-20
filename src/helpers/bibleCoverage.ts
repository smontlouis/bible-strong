import { Book } from '~assets/bible_versions/books-desc'
import { type BibleCanonId, getBook, getBooksForCanon } from '~helpers/bibleBookCatalog'
import { getChapterVerseCount, type BibleVersionCoverage } from '~helpers/biblesDb'

export const getCanonicalChapters = (book: Book) =>
  Array.from({ length: book.Chapitres }, (_, i) => i + 1)

export const getAvailableBookNumbers = (
  coverage?: BibleVersionCoverage,
  canonId: BibleCanonId = 'protestant-66'
) => getBooksForCanon(canonId, coverage?.books).map(book => book.Numero)

export const getAvailableChapters = (book: Book, coverage?: BibleVersionCoverage) => {
  const chapters = coverage?.chaptersByBook[book.Numero]
  return chapters?.length ? chapters : getCanonicalChapters(book)
}

export const findBook = getBook

export const getChapterVerseCountFromCoverage = (
  coverage: BibleVersionCoverage | undefined,
  bookNumber: number,
  chapter: number
) => coverage?.verseCountByBookChapter[`${bookNumber}-${chapter}`]

export const getPreviousAvailableChapterLocation = (
  book: Book,
  chapter: number,
  coverage?: BibleVersionCoverage,
  canonId: BibleCanonId = 'protestant-66'
) => {
  const currentChapters = getAvailableChapters(book, coverage)
  const previousChapter = [...currentChapters].reverse().find(item => item < chapter)

  if (previousChapter) {
    return { book, chapter: previousChapter }
  }

  const availableBookNumbers = getAvailableBookNumbers(coverage, canonId)
  const currentBookIndex = availableBookNumbers.indexOf(book.Numero)
  if (currentBookIndex <= 0) return null

  const previousBook = findBook(availableBookNumbers[currentBookIndex - 1])
  if (!previousBook) return null

  const previousBookChapters = getAvailableChapters(previousBook, coverage)
  const targetChapter = previousBookChapters[previousBookChapters.length - 1]
  if (!targetChapter) return null

  return { book: previousBook, chapter: targetChapter }
}

export const getNextAvailableChapterLocation = (
  book: Book,
  chapter: number,
  coverage?: BibleVersionCoverage,
  canonId: BibleCanonId = 'protestant-66'
) => {
  const currentChapters = getAvailableChapters(book, coverage)
  const nextChapter = currentChapters.find(item => item > chapter)

  if (nextChapter) {
    return { book, chapter: nextChapter }
  }

  const availableBookNumbers = getAvailableBookNumbers(coverage, canonId)
  const currentBookIndex = availableBookNumbers.indexOf(book.Numero)
  if (currentBookIndex === -1 || currentBookIndex >= availableBookNumbers.length - 1) return null

  const nextBook = findBook(availableBookNumbers[currentBookIndex + 1])
  if (!nextBook) return null

  const nextBookChapters = getAvailableChapters(nextBook, coverage)
  const targetChapter = nextBookChapters[0]
  if (!targetChapter) return null

  return { book: nextBook, chapter: targetChapter }
}

export const getMaxChapterVerseCount = async (
  versions: string[],
  bookNumber: number,
  chapter: number
) => {
  if (!versions.length) return 0
  const counts = await Promise.all(
    versions.map(async version => {
      try {
        return await getChapterVerseCount(version, bookNumber, chapter)
      } catch {
        return 0
      }
    })
  )
  return Math.max(...counts)
}

export const getChapterVerseCountSafe = async (
  version: string,
  bookNumber: number,
  chapter: number
) => {
  try {
    return await getChapterVerseCount(version, bookNumber, chapter)
  } catch {
    return 0
  }
}
