import { getBook } from '~helpers/bibleBookCatalog'
import i18n from '~i18n'

/** Book names are stored in French; show them in the interface language, like the rest of the app. */
export const getCommentaryBookLabel = (book: number): string => {
  const name = getBook(book)?.Nom
  return name ? i18n.t(name) : i18n.t('Livre {{bookNumber}}', { bookNumber: book })
}
