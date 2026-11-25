import type { Book } from '~assets/bible_versions/books-desc'
import type { BibleCanonId } from '~helpers/bibleBookCatalog'
import {
  findBook,
  getAvailableBookNumbers,
  getAvailableChapters,
  getNextAvailableChapterLocation,
  getPreviousAvailableChapterLocation,
} from '~helpers/bibleCoverage'
import type { BibleVersionCoverage } from '~helpers/biblesDb'

/**
 * How the player moves through the chapters of a version. A recording of the whole Bible follows
 * the Bible; a partial one (ADR-0117) goes from one of its books to the next, Proverbs 31 to John 1,
 * and stops after its last.
 */

type Location = { book: Book; chapter: number }

/** The chapter before or after, among the books `covers` keeps (every book when absent). */
export const getAdjacentLocation = (
  location: Location,
  direction: 'previous' | 'next',
  coverage: BibleVersionCoverage | undefined,
  canonId: BibleCanonId,
  covers?: (book: number) => boolean
): Location | null => {
  const step = (book: Book, chapter: number) =>
    direction === 'next'
      ? getNextAvailableChapterLocation(book, chapter, coverage, canonId)
      : getPreviousAvailableChapterLocation(book, chapter, coverage, canonId)
  let target = step(location.book, location.chapter)
  // A book the recording skips is left whole: from past its last chapter, or before its first.
  while (target && covers && !covers(target.book.Numero))
    target = step(target.book, direction === 'next' ? Number.MAX_SAFE_INTEGER : 0)
  return target
}

/** The first chapter of the first book a recording covers, in the order of the version's books. */
export const getFirstCoveredLocation = (
  books: number[],
  coverage: BibleVersionCoverage | undefined,
  canonId: BibleCanonId
): Location | null => {
  const bookNumber = getAvailableBookNumbers(coverage, canonId).find(number =>
    books.includes(number)
  )
  const book = bookNumber ? findBook(bookNumber) : undefined
  const chapter = book ? getAvailableChapters(book, coverage)[0] : undefined
  return book && chapter ? { book, chapter } : null
}
