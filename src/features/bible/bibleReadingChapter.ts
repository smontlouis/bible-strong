import type { Pericope } from '~common/types'
import { BibleError, BibleChapterResult } from '~helpers/bibleErrors'
import type { RedWordsByVerse } from '~features/resources/bibleReadingResourceAccess'
import {
  defaultResourceAccess,
  type ResourceAccessRegistry,
} from '~features/resources/resourceAccess'
import type { VersionCode } from '~state/tabs'
import { type StrongMode, usesCanonicalBibleExtras } from '~helpers/strongBiblePublications'
import { getCanonicalChapterPericope } from '~helpers/canonicalBibleHeadings'
import type { InterlinearMode } from '~helpers/interlinearBiblePublications'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { BibleChapterData } from '~features/resources/bibleContentAccess'
import type { ParallelVerse } from './BibleDOM/BibleDOMWrapper'

export type CommentsByVerse = Record<string, string>
export type { RedWordsByVerse }

export interface BibleReadingChapterRequest {
  book: number
  chapter: number
  version: VersionCode
  strongMode?: StrongMode
  interlinearMode?: InterlinearMode
  interlinearLocale?: ResourceLanguage
  interlinearLocaleAutomatic?: boolean
}

export interface BibleReadingExtrasRequest extends BibleReadingChapterRequest {
  parallelVersions: VersionCode[]
  commentsDisplay: boolean
}

export interface BibleReadingMainResult {
  pericope: Pericope
  mainResult: BibleChapterResult<BibleChapterData>
}

export const loadBibleReadingMain = async (
  {
    book,
    chapter,
    version,
    strongMode,
    interlinearMode,
    interlinearLocale,
    interlinearLocaleAutomatic,
  }: BibleReadingChapterRequest,
  resourceAccess: ResourceAccessRegistry = defaultResourceAccess
): Promise<BibleReadingMainResult> => {
  const canonicalExtras = usesCanonicalBibleExtras(version)
  if (!canonicalExtras) {
    const [pericope, mainResult] = await Promise.all([
      resourceAccess.bibleReading.loadPericope(version),
      resourceAccess.bibleContent.loadChapter({
        book,
        chapter,
        version,
        strongMode,
        interlinearMode,
        interlinearLocale,
        interlinearLocaleAutomatic,
      }),
    ])
    return {
      pericope,
      mainResult,
    }
  }

  const mainResult = await resourceAccess.bibleContent.loadChapter({
    book,
    chapter,
    version,
    strongMode,
    interlinearMode,
    interlinearLocale,
    interlinearLocaleAutomatic,
  })
  const pericope =
    mainResult.success && mainResult.data ? getCanonicalChapterPericope(mainResult.data.verses) : {}

  return {
    pericope,
    mainResult,
  }
}

export const loadBibleReadingParallelVerses = async (
  {
    book,
    chapter,
    parallelVersions,
    strongMode,
    interlinearLocale,
    interlinearLocaleAutomatic,
  }: BibleReadingExtrasRequest,
  resourceAccess: ResourceAccessRegistry = defaultResourceAccess
): Promise<ParallelVerse[]> => {
  if (!parallelVersions.length) return []

  const parallelResults = await Promise.all(
    parallelVersions.map(parallelVersion =>
      resourceAccess.bibleContent.loadChapter({
        book,
        chapter,
        version: parallelVersion,
        strongMode,
        interlinearLocale,
        interlinearLocaleAutomatic,
      })
    )
  )

  return parallelResults.map((result, index) => {
    const id = parallelVersions[index]
    if (result.success && result.data) {
      return {
        id,
        verses: result.data.verses,
      }
    }

    return {
      id,
      verses: [],
      error: result.success ? undefined : (result.error as BibleError),
    }
  })
}

export const loadBibleReadingComments = async (
  { book, chapter, commentsDisplay }: BibleReadingExtrasRequest,
  resourceAccess: ResourceAccessRegistry = defaultResourceAccess
): Promise<CommentsByVerse | null> => {
  if (!commentsDisplay) return null

  const comments = await resourceAccess.bibleReading.loadMhyComments(book, chapter)
  if (!comments) return null

  return JSON.parse(comments.serializedComments) as CommentsByVerse
}

export const loadBibleReadingRedWords = async (
  { version }: BibleReadingChapterRequest,
  resourceAccess: ResourceAccessRegistry = defaultResourceAccess
): Promise<RedWordsByVerse | null> => {
  if (usesCanonicalBibleExtras(version)) return null
  try {
    return await resourceAccess.bibleReading.loadRedWords(version)
  } catch {
    return null
  }
}
