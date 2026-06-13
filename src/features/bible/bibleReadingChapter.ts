import type { Pericope, Verse } from '~common/types'
import { BibleError, BibleChapterResult } from '~helpers/bibleErrors'
import { localBibleContentAccess } from '~features/resources/bibleContentAccess'
import {
  localBibleReadingResourceAccess,
  type RedWordsByVerse,
} from '~features/resources/bibleReadingResourceAccess'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import type { VersionCode } from '~state/tabs'
import type { ParallelVerse } from './BibleDOM/BibleDOMWrapper'

export type CommentsByVerse = Record<string, string>
export type { RedWordsByVerse }

export interface BibleReadingChapterRequest {
  book: number
  chapter: number
  version: VersionCode
}

export interface BibleReadingExtrasRequest extends BibleReadingChapterRequest {
  parallelVersions: VersionCode[]
  commentsDisplay: boolean
  lang: string
}

export interface BibleReadingMainResult {
  pericope: Pericope
  mainResult: BibleChapterResult<Verse[] | null>
}

export const loadBibleReadingMain = async ({
  book,
  chapter,
  version,
}: BibleReadingChapterRequest): Promise<BibleReadingMainResult> => {
  const [pericope, mainResult] = await Promise.all([
    localBibleReadingResourceAccess.loadPericope(version),
    localBibleContentAccess.loadChapter({ book, chapter, version }),
  ])

  return {
    pericope,
    mainResult: mainResult as BibleChapterResult<Verse[] | null>,
  }
}

export const loadBibleReadingParallelVerses = async ({
  book,
  chapter,
  parallelVersions,
}: BibleReadingExtrasRequest): Promise<ParallelVerse[]> => {
  if (!parallelVersions.length) return []

  const parallelResults = await Promise.all(
    parallelVersions.map(parallelVersion =>
      localBibleContentAccess.loadChapter({ book, chapter, version: parallelVersion })
    )
  )

  return parallelResults.map((result, index) => {
    const id = parallelVersions[index]
    if (result.success && result.data) {
      return {
        id,
        verses: result.data as Verse[],
      }
    }

    return {
      id,
      verses: [],
      error: result.error as BibleError | undefined,
    }
  })
}

export const loadBibleReadingSecondaryVerses = async ({
  book,
  chapter,
  version,
  lang,
}: BibleReadingExtrasRequest): Promise<Verse[] | null> => {
  if (version !== 'INT' && version !== 'INT_EN') return null

  const secondaryResult = await localBibleContentAccess.loadChapter({
    book,
    chapter,
    version: getDefaultBibleVersion(lang),
  })
  if (secondaryResult.success && secondaryResult.data) {
    return secondaryResult.data as Verse[]
  }

  return null
}

export const loadBibleReadingComments = async ({
  book,
  chapter,
  commentsDisplay,
}: BibleReadingExtrasRequest): Promise<CommentsByVerse | null> => {
  if (!commentsDisplay) return null

  const comments = await localBibleReadingResourceAccess.loadMhyComments(book, chapter)
  if (!comments || 'error' in comments) return null

  return JSON.parse(comments.commentaires) as CommentsByVerse
}

export const loadBibleReadingRedWords = async ({
  version,
}: BibleReadingChapterRequest): Promise<RedWordsByVerse | null> => {
  try {
    return await localBibleReadingResourceAccess.loadRedWords(version)
  } catch {
    return null
  }
}
