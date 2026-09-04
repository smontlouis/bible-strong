import { BibleLoadingError } from '~helpers/bibleErrors'
import { BibleChapterData, loadBibleContentChapter } from '~features/resources/bibleContentAccess'

/**
 * Load a Bible chapter with structured error handling.
 *
 * Compatibility adapter for existing callers. New resource-source behaviour
 * belongs in BibleContentAccess.
 */
const loadBibleChapter = async (book: number, chapter: number, version: string = 'LSG') =>
  loadBibleContentChapter({ book, chapter, version })

export default loadBibleChapter

/**
 * Legacy function that throws errors instead of returning result objects.
 *
 * @deprecated Use loadBibleChapter instead for better error handling.
 */
export const loadBibleChapterLegacy = async (
  book: number,
  chapter: number,
  version: string = 'LSG'
): Promise<BibleChapterData> => {
  const result = await loadBibleChapter(book, chapter, version)

  if (!result.success) {
    throw new BibleLoadingError(
      result.error!.type,
      result.error!.version,
      result.error!.book,
      result.error!.chapter
    )
  }

  return result.data!
}
