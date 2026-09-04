import type { Pericope } from '~common/types'
import { BibleError, BibleChapterResult } from '~helpers/bibleErrors'
import type { RedWordsByVerse } from '~features/resources/bibleReadingResourceAccess'
import {
  defaultResourceAccess,
  type ResourceAccessRegistry,
} from '~features/resources/resourceAccess'
import type { VersionCode } from '~state/tabs'
import {
  resolveStrongBibleVersion,
  type StrongMode,
  usesCanonicalBibleExtras,
} from '~helpers/strongBiblePublications'
import { getCanonicalChapterPericope } from '~helpers/canonicalBibleHeadings'
import {
  isInterlinearCapableBibleVersion,
  type InterlinearMode,
} from '~helpers/interlinearBiblePublications'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type {
  BibleChapterData,
  BibleChapterPresentationSource,
} from '~features/resources/bibleContentAccess'
import type { ParallelVerse } from './BibleDOM/BibleDOMWrapper'

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
  presentation?: BibleChapterPresentationSource
}

export interface BibleReadingMainResult {
  pericope: Pericope
  mainResult: BibleChapterResult<BibleChapterData>
}

const resolveParallelInterlinearMode = (
  version: VersionCode,
  strongMode?: StrongMode,
  interlinearMode?: InterlinearMode
): InterlinearMode | undefined => {
  if (!isInterlinearCapableBibleVersion(version)) return undefined
  if (strongMode === 'visible') return 'strong'
  if (strongMode === 'reverse-interlinear') return 'interlinear'
  return interlinearMode
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
  const mainResult = await resourceAccess.bibleContent.loadChapter({
    book,
    chapter,
    version,
    strongMode,
    interlinearMode,
    interlinearLocale,
    interlinearLocaleAutomatic,
  })
  if (!mainResult.success || !mainResult.data) return { pericope: {}, mainResult }
  if (mainResult.data.presentation === 'legacy-sidecars') {
    return {
      pericope: await resourceAccess.bibleReading.loadPericope(version),
      mainResult,
    }
  }
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
    interlinearMode,
    interlinearLocale,
    interlinearLocaleAutomatic,
  }: BibleReadingExtrasRequest,
  resourceAccess: ResourceAccessRegistry = defaultResourceAccess
): Promise<ParallelVerse[]> => {
  if (!parallelVersions.length) return []

  const requests = parallelVersions.map(parallelVersion => {
    const parallelStrongMode = resolveStrongBibleVersion(parallelVersion, strongMode).strongMode
    return {
      book,
      chapter,
      version: parallelVersion,
      strongMode: parallelStrongMode,
      interlinearMode: resolveParallelInterlinearMode(parallelVersion, strongMode, interlinearMode),
      interlinearLocale,
      interlinearLocaleAutomatic,
    }
  })
  const parallelResults = resourceAccess.bibleContent.loadChapters
    ? await resourceAccess.bibleContent.loadChapters(requests)
    : await Promise.all(requests.map(request => resourceAccess.bibleContent.loadChapter(request)))

  return parallelResults.map((result, index) => {
    const id = parallelVersions[index]
    if (result.success && result.data) {
      return {
        id,
        verses: result.data.verses,
        interlinearMode: requests[index]?.interlinearMode,
      }
    }

    return {
      id,
      verses: [],
      error: result.success ? undefined : (result.error as BibleError),
      interlinearMode: requests[index]?.interlinearMode,
    }
  })
}

export const loadBibleReadingRedWords = async (
  {
    version,
    presentation,
  }: BibleReadingChapterRequest & { presentation?: BibleChapterPresentationSource },
  resourceAccess: ResourceAccessRegistry = defaultResourceAccess
): Promise<RedWordsByVerse | null> => {
  if (presentation === 'canonical' || (!presentation && usesCanonicalBibleExtras(version))) {
    return null
  }
  try {
    return await resourceAccess.bibleReading.loadRedWords(version)
  } catch {
    return null
  }
}
