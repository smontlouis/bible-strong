import type { Book } from '~assets/bible_versions/books-desc'
import { isBookInTestament, type BibleTestament } from '~helpers/bibleBookCatalog'

export interface TestamentGroup {
  /** Absent when the books are sorted by name. */
  testament?: BibleTestament
  books: Book[]
}

export type BookListRow =
  | { type: 'testament'; testament: BibleTestament }
  | { type: 'book'; book: Book }

const testamentOf = (book: Book): BibleTestament =>
  isBookInTestament(book.Numero, 'new') ? 'new' : 'old'

// In the canon's order the books come in their testaments; sorted by name, they mix
export const getTestamentGroups = (books: Book[], isAlphabetical: boolean): TestamentGroup[] =>
  isAlphabetical
    ? [{ books }]
    : (['old', 'new'] as const)
        .map(testament => ({
          testament,
          books: books.filter(book => testamentOf(book) === testament),
        }))
        .filter(group => group.books.length > 0)

/** The rows of the list: each testament's title, then its books. */
export const getBookListRows = (groups: TestamentGroup[]): BookListRow[] =>
  groups.flatMap(group => [
    ...(group.testament ? [{ type: 'testament' as const, testament: group.testament }] : []),
    ...group.books.map(book => ({ type: 'book' as const, book })),
  ])
