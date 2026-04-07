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
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'

type InterlineaireVerse = {
  Texte: string
  Verset: number
  Livre: number
  Chapitre: number
  Hebreu?: string
  Grec?: string
  [key: string]: string | number | undefined
}

type LoadBibleChapterResult = Verse[] | InterlineaireVerse[] | null

/**
 * Build a "no verses" error: either BIBLE_NOT_FOUND (version not installed)
 * or CHAPTER_NOT_FOUND (version installed but chapter missing, e.g. invalid ref).
 */
const buildNoVersesError = async (version: string, bookNb: number, chapterNb: number) => {
  try {
    const needsDownload = await getIfVersionNeedsDownload(version)
    if (needsDownload) {
      return createBibleError('BIBLE_NOT_FOUND', version, bookNb, chapterNb)
    }
  } catch {
    // Fall through to CHAPTER_NOT_FOUND
  }
  return createBibleError('CHAPTER_NOT_FOUND', version, bookNb, chapterNb)
}

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
      if (!res || 'error' in res || (Array.isArray(res) && res.length === 0)) {
        return errorResult(await buildNoVersesError(version, bookNb, chapterNb))
      }
      return successResult(res as LoadBibleChapterResult)
    }

    if (version === 'INT_EN') {
      const res = await loadInterlineaireChapter(bookNb, chapterNb, 'en')
      if (!res || 'error' in res || (Array.isArray(res) && res.length === 0)) {
        return errorResult(await buildNoVersesError(version, bookNb, chapterNb))
      }
      return successResult(res as LoadBibleChapterResult)
    }

    if (version === 'LSGS' || version === 'KJVS') {
      if (!strongDB.get()) await strongDB.init()
      const res = await loadStrongChapter(bookNb, chapterNb)
      if (!res || 'error' in res || (Array.isArray(res) && res.length === 0)) {
        return errorResult(await buildNoVersesError(version, bookNb, chapterNb))
      }
      return successResult(res as LoadBibleChapterResult)
    }

    // Regular versions: query SQLite
    const verses = await getChapterVerses(version, bookNb, chapterNb)
    if (verses.length === 0) {
      return errorResult(await buildNoVersesError(version, bookNb, chapterNb))
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
