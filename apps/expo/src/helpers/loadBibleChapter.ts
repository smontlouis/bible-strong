import { loadBibleContentChapter } from '~features/resources/bibleContentAccess'

/**
 * Load a Bible chapter with structured error handling.
 *
 * Compatibility adapter for existing callers. New resource-source behaviour
 * belongs in BibleContentAccess.
 */
const loadBibleChapter = async (book: number, chapter: number, version: string = 'LSG') =>
  loadBibleContentChapter({ book, chapter, version })

export default loadBibleChapter
