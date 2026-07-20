import books, { type Book } from '~assets/bible_versions/books-desc'

export type BibleCanonId = 'protestant-66' | 'clementine-vulgate'
export type BibleBookCorpus = 'old' | 'deuterocanonical' | 'new'
export type BibleTestament = 'old' | 'new'

const PROTESTANT_BOOK_ORDER = Array.from({ length: 66 }, (_, index) => index + 1)

const CLEMENTINE_BOOK_ORDER = [
  ...Array.from({ length: 16 }, (_, index) => index + 1),
  67,
  68,
  17,
  ...Array.from({ length: 5 }, (_, index) => index + 18),
  69,
  70,
  23,
  24,
  25,
  71,
  26,
  27,
  ...Array.from({ length: 12 }, (_, index) => index + 28),
  72,
  73,
  ...Array.from({ length: 27 }, (_, index) => index + 40),
]

const BOOK_ORDER_BY_CANON: Record<BibleCanonId, number[]> = {
  'protestant-66': PROTESTANT_BOOK_ORDER,
  'clementine-vulgate': CLEMENTINE_BOOK_ORDER,
}

const booksById = new Map<number, Book>(books.map(book => [book.Numero, book]))

export const getBook = (bookId: number) => booksById.get(bookId)

export const getBookCorpus = (bookId: number): BibleBookCorpus | undefined => {
  if (bookId >= 1 && bookId <= 39) return 'old'
  if (bookId >= 40 && bookId <= 66) return 'new'
  if (bookId >= 67 && bookId <= 73) return 'deuterocanonical'
  return undefined
}

export const isBookInTestament = (bookId: number, testament: BibleTestament) => {
  const corpus = getBookCorpus(bookId)
  return testament === 'old' ? corpus === 'old' || corpus === 'deuterocanonical' : corpus === 'new'
}

export const getBooksForCanon = (
  canonId: BibleCanonId,
  availableBookNumbers?: readonly number[]
) => {
  const availableBooks = availableBookNumbers?.length ? new Set(availableBookNumbers) : undefined

  return BOOK_ORDER_BY_CANON[canonId]
    .filter(bookId => !availableBooks || availableBooks.has(bookId))
    .map(getBook)
    .filter((book): book is Book => Boolean(book))
}
