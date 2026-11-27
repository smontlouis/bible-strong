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
import type { BibleColumnTextModes } from '~helpers/bibleColumnTextModes'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type {
  BibleChapterData,
  BibleChapterPresentationSource,
} from '~features/resources/bibleContentAccess'
import type { ParallelVerse } from './BibleDOM/BibleDOMWrapper'
import { alignParallelColumn, getParallelColumnChapters } from './parallelVersification'

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

export interface BibleReadingParallelRequest {
  book: number
  chapter: number
  /**
   * The main version: a column numbered differently shows the verses that correspond to its
   * chapter, from the chapters of its own numbering that hold them.
   */
  mainVersion?: string
  /** Each parallel version with its own Strong and interlinear modes. */
  parallelColumns: readonly BibleColumnTextModes[]
  /** The locale of a column that names none: the application's. */
  defaultInterlinearLocale?: ResourceLanguage
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

// Interlinear-capable versions always carry a mode: hidden unless the column turned it on
const getParallelColumnInterlinearMode = (
  column: Pick<BibleColumnTextModes, 'version' | 'interlinearMode'>
) =>
  isInterlinearCapableBibleVersion(column.version)
    ? (column.interlinearMode ?? 'hidden')
    : undefined

export const loadBibleReadingParallelVerses = async (
  {
    book,
    chapter,
    mainVersion,
    parallelColumns,
    defaultInterlinearLocale,
  }: BibleReadingParallelRequest,
  resourceAccess: ResourceAccessRegistry = defaultResourceAccess
): Promise<ParallelVerse[]> => {
  if (!parallelColumns.length) return []

  const columns = parallelColumns.map(column => {
    const alignedChapters = mainVersion
      ? getParallelColumnChapters({ book, chapter, mainVersion, columnVersion: column.version })
      : undefined
    return {
      id: column.version as VersionCode,
      alignedChapters,
      interlinearMode: getParallelColumnInterlinearMode(column),
      requests: (alignedChapters ?? [chapter]).map(columnChapter => ({
        book,
        chapter: columnChapter,
        version: column.version as VersionCode,
        strongMode: resolveStrongBibleVersion(column.version, column.strongMode).strongMode,
        interlinearMode: getParallelColumnInterlinearMode(column),
        interlinearLocale: column.interlinearLocale ?? defaultInterlinearLocale,
        interlinearLocaleAutomatic: !column.interlinearLocale,
      })),
    }
  })
  const requests = columns.flatMap(column => column.requests)
  const results = resourceAccess.bibleContent.loadChapters
    ? await resourceAccess.bibleContent.loadChapters(requests)
    : await Promise.all(requests.map(request => resourceAccess.bibleContent.loadChapter(request)))

  let offset = 0
  return columns.map(({ id, alignedChapters, interlinearMode, requests: columnRequests }) => {
    const columnResults = results.slice(offset, offset + columnRequests.length)
    offset += columnRequests.length
    const failed = columnResults.find(result => !result.success || !result.data)
    if (failed) {
      return {
        id,
        verses: [],
        error: failed.success ? undefined : (failed.error as BibleError),
        interlinearMode,
      }
    }

    const verses = columnResults.flatMap(result => (result.success ? result.data.verses : []))
    const aligned =
      alignedChapters && mainVersion
        ? alignParallelColumn({
            book,
            chapter,
            mainVersion,
            columnVersion: id,
            columnVerses: verses,
          })
        : undefined
    return aligned
      ? { id, verses: aligned.verses, interlinearMode, alignment: aligned.alignment }
      : { id, verses, interlinearMode }
  })
}

type BibleChapterLocation = Pick<ParallelVerse['verses'][number], 'Livre' | 'Chapitre'>

const isSameChapter = (a: BibleChapterLocation, b: BibleChapterLocation) =>
  Number(a.Livre) === Number(b.Livre) && Number(a.Chapitre) === Number(b.Chapitre)

/**
 * The parallel columns the reader shows, from the tab's settings rather than from what has
 * loaded: the reader is parallel from its first frame. A column whose verses are not those of
 * the chapter shown (still loading, or left from the previous chapter) is marked loading, so
 * two chapters are never shown side by side.
 */
export const getDisplayedParallelVerses = ({
  columns,
  loadedVerses,
  isLoadedForChapter,
  mainVerses,
}: {
  columns: readonly Pick<BibleColumnTextModes, 'version' | 'interlinearMode'>[]
  loadedVerses: readonly ParallelVerse[] | undefined
  // The loaded columns were fetched for the chapter the main version shows
  isLoadedForChapter: boolean
  mainVerses: readonly BibleChapterLocation[]
}): ParallelVerse[] =>
  columns.map((column, index) => {
    const loaded = loadedVerses?.[index]
    const mainVerse = mainVerses[0]
    // An aligned column may start in another chapter (KJV Genesis 31:55 for LSG 32:1)
    const loadedVerse = loaded?.alignment
      ? { Livre: loaded.alignment.book, Chapitre: loaded.alignment.chapter }
      : loaded?.verses[0]
    const showsMainChapter =
      mainVerse && loadedVerse ? isSameChapter(mainVerse, loadedVerse) : isLoadedForChapter

    if (loaded?.id === column.version && showsMainChapter) return loaded

    return {
      id: column.version as VersionCode,
      verses: [],
      interlinearMode: getParallelColumnInterlinearMode(column),
      isLoading: true,
    }
  })

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
