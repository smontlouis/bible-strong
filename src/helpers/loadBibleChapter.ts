import loadInterlineaireChapter from '~helpers/loadInterlineaireChapter'
import loadStrongChapter from '~helpers/loadStrongChapter'
import { strongDB } from '~helpers/sqlite'
import {
  BibleLoadingError,
  BibleChapterResult,
  successResult,
  errorResult,
  createBibleError,
} from '~helpers/bibleErrors'
import { Verse } from '~common/types'
import { getChapterVerses } from '~helpers/biblesDb'

type InterlineaireVerse = {
  Texte: string
  Verset: number
  Livre: number
  Chapitre: number
  Hebreu?: string
  Grec?: string
}

type LoadBibleChapterResult = Verse[] | InterlineaireVerse[] | null

/**
 * Load a Bible chapter with structured error handling
 *
 * Returns a BibleChapterResult that contains either:
 * - success: true with data (verses)
 * - success: false with error details
 */
const loadBibleChapter = async (
  bookNb: number,
  chapterNb: number,
  version: string = 'LSG'
): Promise<BibleChapterResult<LoadBibleChapterResult>> => {
  try {
    if (version === 'INT') {
      const res = await loadInterlineaireChapter(bookNb, chapterNb, 'fr')
      if (!res || (Array.isArray(res) && res.length === 0)) {
        return errorResult(createBibleError('CHAPTER_NOT_FOUND', version, bookNb, chapterNb))
      }
      return successResult(res)
    }

    if (version === 'INT_EN') {
      const res = await loadInterlineaireChapter(bookNb, chapterNb, 'en')
      if (!res || (Array.isArray(res) && res.length === 0)) {
        return errorResult(createBibleError('CHAPTER_NOT_FOUND', version, bookNb, chapterNb))
      }
      return successResult(res)
    }

    if (version === 'LSGS' || version === 'KJVS') {
      if (!strongDB.get()) await strongDB.init()
      const res = await loadStrongChapter(bookNb, chapterNb)
      if (!res || (Array.isArray(res) && res.length === 0)) {
        return errorResult(createBibleError('CHAPTER_NOT_FOUND', version, bookNb, chapterNb))
      }
      return successResult(res)
    }

    // Regular versions: query SQLite
    const verses = await getChapterVerses(version, bookNb, chapterNb)
    if (verses.length === 0) {
      return errorResult(createBibleError('CHAPTER_NOT_FOUND', version, bookNb, chapterNb))
    }
    return successResult(verses)
  } catch (e) {
    console.log('[loadBibleChapter] Error:', e)

    // Handle specific BibleLoadingError types
    if (e instanceof BibleLoadingError) {
      return errorResult(createBibleError(e.type, e.version, bookNb, chapterNb))
    }

    // Handle database corruption or other errors
    const errorMessage = e instanceof Error ? e.toString() : String(e)
    if (errorMessage.includes('no such table') || errorMessage.includes('corrupted')) {
      return errorResult(createBibleError('DATABASE_CORRUPTED', version, bookNb, chapterNb))
    }

    return errorResult(createBibleError('UNKNOWN_ERROR', version, bookNb, chapterNb))
  }
}

export default loadBibleChapter

/**
 * Legacy function that throws errors instead of returning result objects
 * Use loadBibleChapter for new code with structured error handling
 *
 * @deprecated Use loadBibleChapter instead for better error handling
 */
export const loadBibleChapterLegacy = async (
  bookNb: number,
  chapterNb: number,
  version: string = 'LSG'
): Promise<LoadBibleChapterResult> => {
  const result = await loadBibleChapter(bookNb, chapterNb, version)

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
