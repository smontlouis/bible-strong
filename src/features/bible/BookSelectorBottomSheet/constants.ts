import { Book } from '~assets/bible_versions/books-desc'

export type SelectionEvent = {
  type: 'select' | 'longPress'
  book: Book
  chapter: number
}

// Définir une constante pour l'event name pour éviter les typos
export const BOOK_SELECTION_EVENT = 'book-selection'

