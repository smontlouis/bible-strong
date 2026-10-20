import type { Book } from '~assets/bible_versions/books-desc'
import { versions } from '~helpers/bibleVersions'
import i18n, { getLanguage } from '~i18n'

export type ReadingLanguage = 'fr' | 'en'

/**
 * The language of a reading's frame: the book's name, "Chapter", "Psalm". A French or English
 * version brings its own; any other one (Hebrew, Greek, Latin) keeps the app's, so that the
 * frame of a text one studies stays readable.
 */
export const getReadingLanguage = (versionId?: string): ReadingLanguage => {
  const language = versionId ? versions[versionId]?.language : undefined
  if (language === 'fr' || language === 'en') return language
  return getLanguage()
}

/** A frame label (an i18n key) in the reading's language. */
export const translateForReading = (key: string, versionId?: string) =>
  i18n.t(key, { lng: getReadingLanguage(versionId) })

/** The book's name in the reading's language. */
export const getReadingBookName = (book: Pick<Book, 'Nom'>, versionId?: string) =>
  translateForReading(book.Nom, versionId)
