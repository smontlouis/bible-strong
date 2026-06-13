import { Verse } from '~common/types'
import {
  BibleLoadingError,
  BibleChapterResult,
  createBibleError,
  errorResult,
  successResult,
} from '~helpers/bibleErrors'
import { getChapterVerses, getVerseText } from '~helpers/biblesDb'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import loadInterlineaireChapter from '~helpers/loadInterlineaireChapter'
import { strongDB } from '~helpers/sqlite'
import { localStrongAccess, type StrongAccess } from './strongAccess'

export type InterlinearVerse = {
  Texte: string
  Verset: number
  Livre: number
  Chapitre: number
  Hebreu?: string
  Grec?: string
  [key: string]: string | number | undefined
}

export type BibleChapterData = Verse[] | InterlinearVerse[] | null

export type BibleChapterRequest = {
  book: number
  chapter: number
  version: string
}

export type BibleContentAccess = {
  loadChapter: (request: BibleChapterRequest) => Promise<BibleChapterResult<BibleChapterData>>
  loadChapterVerses: typeof getChapterVerses
  loadVerseText: typeof getVerseText
}

type BibleContentAccessDependencies = {
  loadInterlinearChapter: typeof loadInterlineaireChapter
  strongAccess: Pick<StrongAccess, 'loadChapter'>
  getChapterVerses: typeof getChapterVerses
  getIfVersionNeedsDownload: typeof getIfVersionNeedsDownload
  initStrongDatabase: () => Promise<unknown>
  isStrongDatabaseInitialized: () => boolean
  logError: (message: string, error: unknown) => void
}

const defaultDependencies: BibleContentAccessDependencies = {
  loadInterlinearChapter: loadInterlineaireChapter,
  strongAccess: localStrongAccess,
  getChapterVerses,
  getIfVersionNeedsDownload,
  initStrongDatabase: () => strongDB.init(),
  isStrongDatabaseInitialized: () => Boolean(strongDB.get()),
  logError: (message, error) => console.log(message, error),
}

const hasNoChapterRows = (result: unknown): boolean =>
  !result ||
  (typeof result === 'object' && 'error' in result) ||
  (Array.isArray(result) && result.length === 0)

const buildNoVersesError = async (
  request: BibleChapterRequest,
  dependencies: BibleContentAccessDependencies
) => {
  try {
    const needsDownload = await dependencies.getIfVersionNeedsDownload(request.version)
    if (needsDownload) {
      return createBibleError('BIBLE_NOT_FOUND', request.version, request.book, request.chapter)
    }
  } catch {
    // Fall through to CHAPTER_NOT_FOUND.
  }

  return createBibleError('CHAPTER_NOT_FOUND', request.version, request.book, request.chapter)
}

const loadInterlinearBibleChapter = async (
  request: BibleChapterRequest,
  lang: 'fr' | 'en',
  dependencies: BibleContentAccessDependencies
): Promise<BibleChapterResult<BibleChapterData>> => {
  const result = await dependencies.loadInterlinearChapter(request.book, request.chapter, lang)
  if (hasNoChapterRows(result)) {
    return errorResult(await buildNoVersesError(request, dependencies))
  }

  return successResult(result as BibleChapterData)
}

const loadStrongBibleChapter = async (
  request: BibleChapterRequest,
  dependencies: BibleContentAccessDependencies
): Promise<BibleChapterResult<BibleChapterData>> => {
  if (!dependencies.isStrongDatabaseInitialized()) {
    await dependencies.initStrongDatabase()
  }

  const result = await dependencies.strongAccess.loadChapter(request.book, request.chapter)
  if (hasNoChapterRows(result)) {
    return errorResult(await buildNoVersesError(request, dependencies))
  }

  return successResult(result as BibleChapterData)
}

const loadRegularBibleChapter = async (
  request: BibleChapterRequest,
  dependencies: BibleContentAccessDependencies
): Promise<BibleChapterResult<BibleChapterData>> => {
  const verses = await dependencies.getChapterVerses(request.version, request.book, request.chapter)
  if (verses.length === 0) {
    return errorResult(await buildNoVersesError(request, dependencies))
  }

  return successResult(verses)
}

export const loadBibleContentChapter = async (
  request: BibleChapterRequest,
  dependencies: BibleContentAccessDependencies = defaultDependencies
): Promise<BibleChapterResult<BibleChapterData>> => {
  try {
    if (request.version === 'INT') {
      return await loadInterlinearBibleChapter(request, 'fr', dependencies)
    }

    if (request.version === 'INT_EN') {
      return await loadInterlinearBibleChapter(request, 'en', dependencies)
    }

    if (request.version === 'LSGS' || request.version === 'KJVS') {
      return await loadStrongBibleChapter(request, dependencies)
    }

    return await loadRegularBibleChapter(request, dependencies)
  } catch (error) {
    dependencies.logError('[BibleContentAccess] Error loading chapter:', error)

    if (error instanceof BibleLoadingError) {
      return errorResult(createBibleError(error.type, error.version, request.book, request.chapter))
    }

    const errorMessage = error instanceof Error ? error.toString() : String(error)
    if (errorMessage.includes('no such table') || errorMessage.includes('corrupted')) {
      return errorResult(
        createBibleError('DATABASE_CORRUPTED', request.version, request.book, request.chapter)
      )
    }

    return errorResult(
      createBibleError('UNKNOWN_ERROR', request.version, request.book, request.chapter)
    )
  }
}

export const localBibleContentAccess: BibleContentAccess = {
  loadChapter: loadBibleContentChapter,
  loadChapterVerses: getChapterVerses,
  loadVerseText: getVerseText,
}
