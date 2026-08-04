import { Verse } from '~common/types'
import {
  BibleLoadingError,
  BibleChapterResult,
  createBibleError,
  errorResult,
  successResult,
} from '~helpers/bibleErrors'
import type { BibleRecoveryAction } from '~helpers/bibleErrors'
import {
  getBibleVersionCoverage,
  getChapterVerses,
  getMultipleVerses,
  type BibleVersionCoverage,
} from '~helpers/biblesDb'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { localStrongLexiconAccess, type StrongLexiconAccess } from './strongLexiconAccess'
import {
  isStrongCapableBibleVersion,
  resolveStrongBibleVersion,
  type StrongBibleVersionId,
  type StrongMode,
} from '~helpers/strongBiblePublications'
import {
  loadReverseInterlinearChapterSpans,
  loadStrongBibleChapterSpans,
} from '~helpers/strongBibleSidecar'
import {
  getInterlinearLocalePriority,
  isInterlinearModeEnabled,
  normalizeInterlinearMode,
  type InterlinearMode,
} from '~helpers/interlinearDisplayMode'
import { loadInterlinearChapterTokens } from '~helpers/interlinearBibleSidecar'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import {
  buildReverseInterlinearSpans,
  getMissingReverseInterlinearStrongCodes,
  type ReverseInterlinearLexicalEntry,
} from '~helpers/reverseInterlinearBible'
import {
  createStrongIdentityForBook,
  resolveDisplayedStrongIdentities,
} from '~helpers/strongIdentities'
import { collectStrongSelectionMorphologies } from '~helpers/strongSelection'
import { getResourceLanguage } from '~state/resourcesLanguage'

export type BibleChapterData =
  | { kind: 'plain'; verses: Verse[] }
  | { kind: 'strong'; verses: Verse[] }
  | { kind: 'interlinear'; verses: Verse[] }
  | { kind: 'reverse-interlinear'; verses: Verse[] }

export type BibleChapterRequest = {
  book: number
  chapter: number
  version: string
  strongMode?: StrongMode
  interlinearMode?: InterlinearMode
  interlinearLocale?: ResourceLanguage
  interlinearLocaleAutomatic?: boolean
}

export type BibleContentAccess = {
  loadChapter: (request: BibleChapterRequest) => Promise<BibleChapterResult<BibleChapterData>>
  loadVerseTexts: (request: {
    version: string
    verseKeys: string[]
    shouldCancel?: () => boolean
  }) => Promise<Record<string, string>>
  loadCoverage: (version: string) => Promise<BibleVersionCoverage>
  getAvailability?: (version: string) => Promise<{
    status: 'available' | 'unavailable'
    recoveries?: BibleRecoveryAction[]
  }>
}

export type BibleChapterSourceResult =
  | { status: 'available'; verses: Verse[] }
  | {
      status: 'unavailable'
      reason: 'publication-not-available' | 'chapter-not-available' | 'offline-copy-invalid'
      recoveries?: BibleRecoveryAction[]
    }

export type BibleChapterAdapter = {
  loadChapter: (version: string, book: number, chapter: number) => Promise<BibleChapterSourceResult>
}

type BibleContentAccessDependencies = {
  strongLexicon: Pick<StrongLexiconAccess, 'loadPreview'>
  getStrongResourceLanguage: () => ResourceLanguage
  chapterAdapter: BibleChapterAdapter
  logError: (message: string, error: unknown) => void
  loadStrongBibleChapterSpans?: typeof loadStrongBibleChapterSpans
  loadReverseInterlinearChapterSpans?: typeof loadReverseInterlinearChapterSpans
  loadInterlinearChapterTokens?: typeof loadInterlinearChapterTokens
}

export const localBibleChapterAdapter: BibleChapterAdapter = {
  async loadChapter(version, book, chapter) {
    try {
      const verses = await getChapterVerses(version, book, chapter)
      if (verses.length > 0) return { status: 'available', verses }

      try {
        if (await getIfVersionNeedsDownload(version)) {
          return {
            status: 'unavailable',
            reason: 'publication-not-available',
            recoveries: ['acquire-offline-copy'],
          }
        }
      } catch {
        // An inconclusive availability check still means the requested chapter is unavailable.
      }
      return { status: 'unavailable', reason: 'chapter-not-available' }
    } catch (error) {
      if (error instanceof BibleLoadingError) {
        if (error.type === 'BIBLE_NOT_FOUND') {
          return {
            status: 'unavailable',
            reason: 'publication-not-available',
            recoveries: ['acquire-offline-copy'],
          }
        }
        if (error.type === 'CHAPTER_NOT_FOUND') {
          return { status: 'unavailable', reason: 'chapter-not-available' }
        }
        if (error.type === 'OFFLINE_COPY_INVALID') {
          return {
            status: 'unavailable',
            reason: 'offline-copy-invalid',
            recoveries: ['manage-offline-copies', 'reset-offline-store'],
          }
        }
      }

      const storageMessage = error instanceof Error ? error.toString() : String(error)
      if (storageMessage.includes('no such table') || storageMessage.includes('corrupted')) {
        return {
          status: 'unavailable',
          reason: 'offline-copy-invalid',
          recoveries: ['manage-offline-copies', 'reset-offline-store'],
        }
      }
      throw error
    }
  },
}

const defaultDependencies: BibleContentAccessDependencies = {
  strongLexicon: localStrongLexiconAccess,
  getStrongResourceLanguage: () => getResourceLanguage('STRONG'),
  chapterAdapter: localBibleChapterAdapter,
  logError: (message, error) => console.log(message, error),
  loadStrongBibleChapterSpans,
  loadReverseInterlinearChapterSpans,
  loadInterlinearChapterTokens,
}

const loadRegularBibleChapter = async (
  request: BibleChapterRequest,
  dependencies: BibleContentAccessDependencies
): Promise<BibleChapterResult<BibleChapterData>> => {
  const chapter = await dependencies.chapterAdapter.loadChapter(
    request.version,
    request.book,
    request.chapter
  )
  if (chapter.status === 'unavailable') {
    const errorType =
      chapter.reason === 'publication-not-available'
        ? 'BIBLE_NOT_FOUND'
        : chapter.reason === 'chapter-not-available'
          ? 'CHAPTER_NOT_FOUND'
          : 'OFFLINE_COPY_INVALID'
    return errorResult(
      createBibleError(
        errorType,
        request.version,
        request.book,
        request.chapter,
        chapter.recoveries
      )
    )
  }
  const { verses } = chapter

  if (
    request.version === 'BHG' &&
    isInterlinearModeEnabled(request.interlinearMode) &&
    dependencies.loadInterlinearChapterTokens
  ) {
    const preferredLocale = request.interlinearLocale ?? 'fr'
    const displayMode = normalizeInterlinearMode(request.interlinearMode)
    const locales =
      request.interlinearLocaleAutomatic || displayMode !== 'interlinear'
        ? getInterlinearLocalePriority(preferredLocale)
        : ([preferredLocale] as const)

    for (const locale of locales) {
      try {
        const tokensByVerse = await dependencies.loadInterlinearChapterTokens(
          'BHG',
          locale,
          request.book,
          request.chapter
        )
        return successResult({
          kind: 'interlinear',
          verses: verses.map(verse => ({
            ...verse,
            InterlinearTokens: tokensByVerse[Number(verse.Verset)] ?? [],
          })),
        })
      } catch (error) {
        dependencies.logError(
          `[BibleContentAccess] Interlinear ${locale} sidecar unavailable:`,
          error
        )
      }
    }
    return successResult({ kind: 'plain', verses })
  }

  if (
    request.strongMode === 'reverse-interlinear' &&
    isStrongCapableBibleVersion(request.version) &&
    dependencies.loadReverseInterlinearChapterSpans &&
    dependencies.loadInterlinearChapterTokens
  ) {
    try {
      const [targetSpansByVerse, originalVerses] = await Promise.all([
        dependencies.loadReverseInterlinearChapterSpans(
          request.version as StrongBibleVersionId,
          request.book,
          request.chapter
        ),
        dependencies.chapterAdapter.loadChapter('BHG', request.book, request.chapter),
      ])
      const preferredLocale = request.interlinearLocale ?? 'fr'
      let sourceTokensByVerse: Awaited<ReturnType<typeof loadInterlinearChapterTokens>> = {}
      for (const locale of getInterlinearLocalePriority(preferredLocale)) {
        try {
          sourceTokensByVerse = await dependencies.loadInterlinearChapterTokens(
            'BHG',
            locale,
            request.book,
            request.chapter
          )
          break
        } catch (error) {
          dependencies.logError(
            `[BibleContentAccess] Reverse interlinear ${locale} index unavailable:`,
            error
          )
        }
      }

      const originalTextByVerse = new Map(
        (originalVerses.status === 'available' ? originalVerses.verses : []).map(
          verse => [Number(verse.Verset), verse.Texte] as const
        )
      )
      let lexicalEntries: ReverseInterlinearLexicalEntry[] = []
      let reverseSpansByVerse = Object.fromEntries(
        Object.entries(targetSpansByVerse).map(([verse, spans]) => [
          verse,
          buildReverseInterlinearSpans({
            originalText: originalTextByVerse.get(Number(verse)) ?? '',
            targetSpans: spans,
            sourceTokens: sourceTokensByVerse[Number(verse)] ?? [],
            lexicalEntries,
          }),
        ])
      )
      const fallbackReferences = [
        ...new Set(
          Object.values(reverseSpansByVerse).flat().flatMap(getMissingReverseInterlinearStrongCodes)
        ),
      ]
      if (fallbackReferences.length > 0) {
        try {
          const loadedEntries = await dependencies.strongLexicon.loadPreview(
            fallbackReferences.map(reference =>
              createStrongIdentityForBook(reference, request.book)
            ),
            dependencies.getStrongResourceLanguage()
          )
          lexicalEntries = loadedEntries.map(entry => ({
            Code: entry.classicStrong,
            Hebreu: entry.language === 'hebrew' ? entry.original : '',
            Grec: entry.language === 'greek' ? entry.original : '',
            Phonetique: entry.transliteration,
          }))
          reverseSpansByVerse = Object.fromEntries(
            Object.entries(targetSpansByVerse).map(([verse, spans]) => [
              verse,
              buildReverseInterlinearSpans({
                originalText: originalTextByVerse.get(Number(verse)) ?? '',
                targetSpans: spans,
                sourceTokens: sourceTokensByVerse[Number(verse)] ?? [],
                lexicalEntries,
              }),
            ])
          )
        } catch (error) {
          dependencies.logError('[BibleContentAccess] Strong lexical fallback unavailable:', error)
        }
      }

      return successResult({
        kind: 'reverse-interlinear',
        verses: verses.map(verse => ({
          ...verse,
          ReverseInterlinearSpans: reverseSpansByVerse[Number(verse.Verset)] ?? [],
        })),
      })
    } catch (error) {
      dependencies.logError('[BibleContentAccess] Reverse interlinear unavailable:', error)
      return successResult({ kind: 'plain', verses })
    }
  }

  if (
    request.strongMode !== 'visible' ||
    !isStrongCapableBibleVersion(request.version) ||
    !dependencies.loadStrongBibleChapterSpans
  ) {
    return successResult({ kind: 'plain', verses })
  }

  try {
    const spansByVerse = await dependencies.loadStrongBibleChapterSpans(
      request.version as StrongBibleVersionId,
      request.book,
      request.chapter
    )
    let alignedTokensByVerse: Awaited<ReturnType<typeof loadInterlinearChapterTokens>> = {}
    if (dependencies.loadInterlinearChapterTokens) {
      for (const locale of getInterlinearLocalePriority(request.interlinearLocale ?? 'fr')) {
        try {
          alignedTokensByVerse = await dependencies.loadInterlinearChapterTokens(
            'BHG',
            locale,
            request.book,
            request.chapter
          )
          break
        } catch {
          // The Strong view remains available without the optional BHG alignment.
        }
      }
    }
    return successResult({
      kind: 'strong',
      verses: verses.map(verse => {
        const verseNumber = Number(verse.Verset)
        const alignedTokens = alignedTokensByVerse[verseNumber] ?? []
        const alignedTokensById = new Map(
          alignedTokens.flatMap(token => (token.id == null ? [] : [[token.id, token] as const]))
        )
        return {
          ...verse,
          StrongSpans: (spansByVerse[verseNumber] ?? []).map(span => {
            const alignedSegments = (span.stepTokenIds ?? []).flatMap(
              tokenId => alignedTokensById.get(tokenId)?.segments ?? []
            )
            const identities = resolveDisplayedStrongIdentities(
              span.identities,
              alignedSegments.flatMap(segment => segment.identities)
            )
            const morphologies = collectStrongSelectionMorphologies(identities, alignedSegments)
            return {
              ...span,
              identities,
              ...(morphologies.length ? { morphologies } : {}),
            }
          }),
        }
      }),
    })
  } catch (error) {
    dependencies.logError('[BibleContentAccess] Strong sidecar unavailable:', error)
    return successResult({ kind: 'plain', verses })
  }
}

export const loadBibleContentChapter = async (
  request: BibleChapterRequest,
  dependencies: BibleContentAccessDependencies = defaultDependencies
): Promise<BibleChapterResult<BibleChapterData>> => {
  try {
    const resolved = resolveStrongBibleVersion(request.version, request.strongMode)
    const normalizedRequest = {
      ...request,
      version: resolved.versionId,
      strongMode: resolved.strongMode,
    }
    return await loadRegularBibleChapter(normalizedRequest, dependencies)
  } catch (error) {
    dependencies.logError('[BibleContentAccess] Error loading chapter:', error)

    if (error instanceof BibleLoadingError) {
      return errorResult(createBibleError(error.type, error.version, request.book, request.chapter))
    }

    return errorResult(
      createBibleError('UNKNOWN_ERROR', request.version, request.book, request.chapter)
    )
  }
}

export const localBibleContentAccess: BibleContentAccess = {
  loadChapter: loadBibleContentChapter,
  loadVerseTexts: ({ version, verseKeys, shouldCancel }) =>
    getMultipleVerses(version, verseKeys, shouldCancel),
  loadCoverage: getBibleVersionCoverage,
  getAvailability: async version =>
    (await getIfVersionNeedsDownload(version))
      ? { status: 'unavailable', recoveries: ['acquire-offline-copy'] }
      : { status: 'available' },
}
