import { Verse } from '~common/types'
import {
  BibleLoadingError,
  BibleChapterResult,
  createBibleError,
  errorResult,
  getBibleRecoveryActions,
  successResult,
} from '~helpers/bibleErrors'
import type { BibleRecoveryAction } from '~helpers/bibleErrors'
import {
  getBibleVersionCoverage,
  getBibleVersionMetadata,
  getChapterVerses,
  getMultipleVerses,
  type BibleVersionCoverage,
} from '~helpers/biblesDb'
import {
  getBibleVersionCanonId,
  getBibleVersionVersificationId,
  getIfVersionNeedsDownload,
} from '~helpers/bibleVersions'
import { getBook, getBooksForCanon } from '~helpers/bibleBookCatalog'
import {
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
  type StrongMode,
  usesCanonicalBibleExtras,
} from '~helpers/strongBiblePublications'
import {
  loadReverseInterlinearChapterSpans,
  loadStrongBibleChapterSpans,
} from '~helpers/strongBibleSidecar'
import {
  getInterlinearLocalePriority,
  isInterlinearModeEnabled,
  type InterlinearMode,
} from '~helpers/interlinearDisplayMode'
import { loadInterlinearChapterTokens } from '~helpers/interlinearBibleSidecar'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import {
  buildReverseInterlinearSpans,
  getMissingReverseInterlinearStrongCodes,
} from '~helpers/reverseInterlinearBible'
import { resolveDisplayedStrongIdentities } from '~helpers/strongIdentities'
import { collectStrongSelectionMorphologies } from '~helpers/strongSelection'
import {
  type BibleChapterAdapter,
  type BibleChapterUnavailableReason,
  loadVerseTextsFromChapterAdapter,
  BibleVerseTextSourceError,
} from './bibleChapterSource'
import {
  localStrongBibleResourceAccess,
  type StrongBibleChapterSpansPayload,
  type StrongBibleResourceAccess,
} from './strongBibleResourceAccess'
import {
  ResourceAccessError,
  resourceAccessErrorFromBibleChapterUnavailable,
} from './resourceAccessError'
import {
  localInterlinearBibleResourceAccess,
  type InterlinearBibleResourceAccess,
} from './interlinearBibleResourceAccess'

export type { BibleChapterAdapter, BibleChapterSourceResult } from './bibleChapterSource'

const isCanonicalChapterForVersion = (version: string, book: number, chapter: number) => {
  const canonicalBook = getBook(book)
  return (
    Boolean(canonicalBook) &&
    chapter >= 1 &&
    chapter <= (canonicalBook?.Chapitres ?? 0) &&
    getBooksForCanon(getBibleVersionCanonId(version)).some(item => item.Numero === book)
  )
}

export type BibleChapterPresentationSource = 'canonical' | 'legacy-sidecars'

export type BibleChapterData =
  | { kind: 'plain'; verses: Verse[]; presentation: BibleChapterPresentationSource }
  | { kind: 'strong'; verses: Verse[]; presentation: BibleChapterPresentationSource }
  | { kind: 'interlinear'; verses: Verse[]; presentation: BibleChapterPresentationSource }
  | {
      kind: 'reverse-interlinear'
      verses: Verse[]
      presentation: BibleChapterPresentationSource
    }

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

const loadLocalBibleCoverage = async (version: string): Promise<BibleVersionCoverage> => {
  const coverage = await getBibleVersionCoverage(version)
  const canonId = getBibleVersionCanonId(version)
  return {
    ...coverage,
    canon: { id: canonId, orderedBooks: getBooksForCanon(canonId).map(book => book.Numero) },
    versification: getBibleVersionVersificationId(version),
  }
}

type BibleContentAccessDependencies = {
  chapterAdapter: BibleChapterAdapter
  logError: (message: string, error: unknown) => void
  loadStrongBibleChapterSpans?: (
    versionId: StrongBibleVersionId,
    book: number,
    chapter: number
  ) => Promise<
    | Record<number, import('~helpers/canonicalStrongVerse').StrongBibleSpan[]>
    | StrongBibleChapterSpansPayload
  >
  loadReverseInterlinearChapterSpans?: (
    versionId: StrongBibleVersionId,
    book: number,
    chapter: number
  ) => Promise<
    | Record<number, import('~helpers/canonicalStrongVerse').StrongBibleSpan[]>
    | StrongBibleChapterSpansPayload
  >
  loadInterlinearChapterTokens?: typeof loadInterlinearChapterTokens
  getInterlinearAvailability?: InterlinearBibleResourceAccess['getAvailability']
}

export const localBibleChapterAdapter: BibleChapterAdapter = {
  async loadVerseTexts(version, verseKeys, shouldCancel) {
    try {
      const texts = await getMultipleVerses(version, verseKeys, shouldCancel)
      if (Object.keys(texts).length > 0) {
        const metadata = await getBibleVersionMetadata(version)
        return {
          status: 'available',
          texts,
          ...(metadata?.textRevision ? { textRevision: metadata.textRevision } : {}),
          ...(metadata?.textSha256 ? { textSha256: metadata.textSha256 } : {}),
        }
      }
      if (await getIfVersionNeedsDownload(version)) {
        return {
          status: 'unavailable',
          reason: 'publication-not-available',
          recoveries: ['acquire-offline-copy'],
        }
      }
      return { status: 'unavailable', reason: 'verses-not-available' }
    } catch (error) {
      if (error instanceof BibleLoadingError && error.type === 'BIBLE_NOT_FOUND') {
        return {
          status: 'unavailable',
          reason: 'publication-not-available',
          recoveries: ['acquire-offline-copy'],
        }
      }
      return {
        status: 'unavailable',
        reason: 'offline-copy-invalid',
        recoveries: ['manage-offline-copies', 'reset-offline-store'],
      }
    }
  },
  async loadChapter(version, book, chapter) {
    try {
      const verses = await getChapterVerses(version, book, chapter)
      if (verses.length > 0) {
        const metadata = await getBibleVersionMetadata(version)
        return {
          status: 'available',
          verses,
          presentation: metadata?.schemaVersion === 4 ? 'canonical' : 'legacy-sidecars',
          ...(metadata?.textRevision ? { textRevision: metadata.textRevision } : {}),
          ...(metadata?.textSha256 ? { textSha256: metadata.textSha256 } : {}),
        }
      }

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
      return isCanonicalChapterForVersion(version, book, chapter)
        ? {
            status: 'unavailable',
            reason: 'offline-copy-invalid',
            recoveries: ['manage-offline-copies', 'reset-offline-store'],
          }
        : { status: 'unavailable', reason: 'chapter-not-available' }
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
  async loadCoverage(version) {
    try {
      const [coverage, metadata] = await Promise.all([
        loadLocalBibleCoverage(version),
        getBibleVersionMetadata(version),
      ])
      return {
        status: 'available',
        coverage,
        ...(metadata?.textRevision ? { textRevision: metadata.textRevision } : {}),
        ...(metadata?.textSha256 ? { textSha256: metadata.textSha256 } : {}),
      }
    } catch {
      return { status: 'unavailable', reason: 'offline-copy-invalid' }
    }
  },
}

const unavailableReasonToErrorType = (
  reason: BibleChapterUnavailableReason
): import('~helpers/bibleErrors').BibleErrorType => {
  switch (reason) {
    case 'publication-not-available':
      return 'BIBLE_NOT_FOUND'
    case 'chapter-not-available':
    case 'verses-not-available':
      return 'CHAPTER_NOT_FOUND'
    case 'offline-copy-invalid':
      return 'OFFLINE_COPY_INVALID'
    case 'resource-unsupported':
      return 'RESOURCE_UNSUPPORTED'
    case 'network-offline':
      return 'RESOURCE_OFFLINE'
    case 'temporary-unavailable':
      return 'RESOURCE_TEMPORARY_UNAVAILABLE'
    case 'integrity-failure':
      return 'RESOURCE_INTEGRITY_ERROR'
  }
}

const resourceAccessErrorToBibleErrorType = (
  code: ResourceAccessError['code']
): import('~helpers/bibleErrors').BibleErrorType => {
  switch (code) {
    case 'OFFLINE_COPY_REQUIRED':
      return 'BIBLE_NOT_FOUND'
    case 'INVALID_OFFLINE_COPY':
      return 'OFFLINE_COPY_INVALID'
    case 'NETWORK_OFFLINE':
      return 'RESOURCE_OFFLINE'
    case 'RESOURCE_UNSUPPORTED':
      return 'RESOURCE_UNSUPPORTED'
    case 'INTEGRITY_FAILURE':
      return 'RESOURCE_INTEGRITY_ERROR'
    case 'TEMPORARY_UNAVAILABLE':
      return 'RESOURCE_TEMPORARY_UNAVAILABLE'
    case 'NOT_FOUND':
      return 'CHAPTER_NOT_FOUND'
    case 'UNKNOWN':
      return 'UNKNOWN_ERROR'
  }
}

const defaultDependencies: BibleContentAccessDependencies = {
  chapterAdapter: localBibleChapterAdapter,
  logError: (message, error) => console.log(message, error),
  loadStrongBibleChapterSpans,
  loadReverseInterlinearChapterSpans,
  loadInterlinearChapterTokens,
  getInterlinearAvailability: localInterlinearBibleResourceAccess.getAvailability,
}

const resolveRequestedInterlinearLocale = async (
  request: BibleChapterRequest,
  dependencies: BibleContentAccessDependencies
): Promise<ResourceLanguage> => {
  const preferredLocale = request.interlinearLocale ?? 'fr'
  if (!request.interlinearLocaleAutomatic || !dependencies.getInterlinearAvailability) {
    return preferredLocale
  }
  for (const locale of getInterlinearLocalePriority(preferredLocale)) {
    const availability = await dependencies.getInterlinearAvailability(locale)
    if (availability.status === 'available') return locale
    if (availability.status !== 'missing') return preferredLocale
  }
  return preferredLocale
}

const loadRegularBibleChapter = async (
  request: BibleChapterRequest,
  dependencies: BibleContentAccessDependencies
): Promise<BibleChapterResult<BibleChapterData>> => {
  if (
    request.version === 'BHG' &&
    isInterlinearModeEnabled(request.interlinearMode) &&
    !dependencies.loadInterlinearChapterTokens
  ) {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED')
  }
  if (
    request.strongMode === 'reverse-interlinear' &&
    (!isStrongCapableBibleVersion(request.version) ||
      !dependencies.loadReverseInterlinearChapterSpans ||
      !dependencies.loadInterlinearChapterTokens)
  ) {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED')
  }
  if (
    request.strongMode === 'visible' &&
    (!isStrongCapableBibleVersion(request.version) || !dependencies.loadStrongBibleChapterSpans)
  ) {
    throw new ResourceAccessError('RESOURCE_UNSUPPORTED')
  }
  const chapter = await dependencies.chapterAdapter.loadChapter(
    request.version,
    request.book,
    request.chapter
  )
  if (chapter.status === 'unavailable') {
    if (chapter.diagnostics) {
      throw resourceAccessErrorFromBibleChapterUnavailable(
        chapter.reason,
        chapter.recoveries,
        chapter.diagnostics
      )
    }
    return errorResult(
      createBibleError(
        unavailableReasonToErrorType(chapter.reason),
        request.version,
        request.book,
        request.chapter,
        chapter.recoveries ?? getBibleRecoveryActions(unavailableReasonToErrorType(chapter.reason))
      )
    )
  }
  const { verses } = chapter
  const presentation =
    chapter.presentation ??
    (usesCanonicalBibleExtras(request.version) ? 'canonical' : 'legacy-sidecars')

  if (
    request.version === 'BHG' &&
    isInterlinearModeEnabled(request.interlinearMode) &&
    dependencies.loadInterlinearChapterTokens
  ) {
    const locale = await resolveRequestedInterlinearLocale(request, dependencies)
    const tokensByVerse = await dependencies.loadInterlinearChapterTokens(
      'BHG',
      locale,
      request.book,
      request.chapter
    )
    if (
      verses.some(verse => {
        const tokens = tokensByVerse[Number(verse.Verset)]
        return !tokens || tokens.length === 0
      })
    ) {
      throw new ResourceAccessError('INTEGRITY_FAILURE')
    }
    return successResult({
      kind: 'interlinear',
      presentation,
      verses: verses.map(verse => ({
        ...verse,
        InterlinearTokens: tokensByVerse[Number(verse.Verset)] ?? [],
      })),
    })
  }

  if (
    request.strongMode === 'reverse-interlinear' &&
    isStrongCapableBibleVersion(request.version) &&
    dependencies.loadReverseInterlinearChapterSpans &&
    dependencies.loadInterlinearChapterTokens
  ) {
    const [strongChapter, originalVerses] = await Promise.all([
      dependencies.loadReverseInterlinearChapterSpans(
        request.version as StrongBibleVersionId,
        request.book,
        request.chapter
      ),
      dependencies.chapterAdapter.loadChapter('BHG', request.book, request.chapter),
    ])
    const targetSpansByVerse =
      'spansByVerse' in strongChapter ? strongChapter.spansByVerse : strongChapter
    if (
      'spansByVerse' in strongChapter &&
      ((strongChapter.textRevision !== undefined &&
        chapter.textRevision !== strongChapter.textRevision) ||
        (strongChapter.textSha256 !== undefined && chapter.textSha256 !== strongChapter.textSha256))
    ) {
      throw new ResourceAccessError('INTEGRITY_FAILURE')
    }
    if (originalVerses.status === 'unavailable') {
      throw resourceAccessErrorFromBibleChapterUnavailable(
        originalVerses.reason,
        originalVerses.recoveries,
        originalVerses.diagnostics
      )
    }
    const locale = await resolveRequestedInterlinearLocale(request, dependencies)
    const sourceTokensByVerse = await dependencies.loadInterlinearChapterTokens(
      'BHG',
      locale,
      request.book,
      request.chapter
    )
    const originalTextByVerse = new Map(
      originalVerses.verses.map(verse => [Number(verse.Verset), verse.Texte] as const)
    )
    const sourceTokens = Object.entries(sourceTokensByVerse).flatMap(([verse, tokens]) => {
      const originalText = originalTextByVerse.get(Number(verse))
      if (originalText === undefined) return []
      return tokens.flatMap(token => {
        const tokenEnd = token.startOffset + token.length
        if (token.startOffset < 0 || token.length < 0 || tokenEnd > originalText.length) return []
        return [{ ...token, surface: originalText.slice(token.startOffset, tokenEnd) }]
      })
    })
    const sourceTokenIds = new Set(
      sourceTokens.flatMap(token => (token.id === undefined ? [] : [token.id]))
    )
    const requiredSourceTokenIds = Object.values(targetSpansByVerse)
      .flat()
      .flatMap(span => span.stepTokenIds ?? [])
    if (requiredSourceTokenIds.some(tokenId => !sourceTokenIds.has(tokenId))) {
      throw new ResourceAccessError('INTEGRITY_FAILURE')
    }
    const reverseSpansByVerse = Object.fromEntries(
      Object.entries(targetSpansByVerse).map(([verse, spans]) => [
        verse,
        buildReverseInterlinearSpans({
          targetSpans: spans,
          sourceTokens,
        }),
      ])
    )
    const missingReferences = [
      ...new Set(
        Object.values(reverseSpansByVerse).flat().flatMap(getMissingReverseInterlinearStrongCodes)
      ),
    ]
    if (missingReferences.length > 0) throw new ResourceAccessError('INTEGRITY_FAILURE')

    return successResult({
      kind: 'reverse-interlinear',
      presentation,
      verses: verses.map(verse => ({
        ...verse,
        ReverseInterlinearSpans: reverseSpansByVerse[Number(verse.Verset)] ?? [],
      })),
    })
  }

  if (request.strongMode !== 'visible') {
    return successResult({ kind: 'plain', verses, presentation })
  }

  const strongChapter = await dependencies.loadStrongBibleChapterSpans!(
    request.version as StrongBibleVersionId,
    request.book,
    request.chapter
  )
  const spansByVerse = 'spansByVerse' in strongChapter ? strongChapter.spansByVerse : strongChapter
  if (
    'spansByVerse' in strongChapter &&
    ((strongChapter.textRevision !== undefined &&
      chapter.textRevision !== strongChapter.textRevision) ||
      (strongChapter.textSha256 !== undefined && chapter.textSha256 !== strongChapter.textSha256))
  ) {
    throw new ResourceAccessError('INTEGRITY_FAILURE')
  }
  let alignedTokensByVerse: Awaited<ReturnType<typeof loadInterlinearChapterTokens>> = {}
  if (dependencies.loadInterlinearChapterTokens) {
    try {
      alignedTokensByVerse = await dependencies.loadInterlinearChapterTokens(
        'BHG',
        request.interlinearLocale ?? 'fr',
        request.book,
        request.chapter
      )
    } catch {
      // BHG morphology is optional enrichment; never replace its locale after a load failure.
    }
  }
  return successResult({
    kind: 'strong',
    presentation,
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
}

export const loadBibleContentChapter = async (
  request: BibleChapterRequest,
  dependencies: BibleContentAccessDependencies = defaultDependencies
): Promise<BibleChapterResult<BibleChapterData>> => {
  try {
    return await loadRegularBibleChapter(request, dependencies)
  } catch (error) {
    dependencies.logError('[BibleContentAccess] Error loading chapter:', error)

    if (error instanceof BibleLoadingError) {
      return errorResult(createBibleError(error.type, error.version, request.book, request.chapter))
    }

    if (error instanceof ResourceAccessError) {
      const type = resourceAccessErrorToBibleErrorType(error.code)
      return errorResult(
        createBibleError(
          type,
          request.version,
          request.book,
          request.chapter,
          getBibleRecoveryActions(type)
        )
      )
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
  loadCoverage: loadLocalBibleCoverage,
  getAvailability: async version =>
    (await getIfVersionNeedsDownload(version))
      ? { status: 'unavailable', recoveries: ['acquire-offline-copy'] }
      : { status: 'available' },
}

export const createBibleContentAccess = (
  chapterAdapter: BibleChapterAdapter,
  strongBibleAccess: {
    loadChapterSpans: NonNullable<StrongBibleResourceAccess['loadChapterSpans']>
  } = localStrongBibleResourceAccess,
  interlinearBibleAccess: Pick<
    InterlinearBibleResourceAccess,
    'getAvailability' | 'loadChapterTokens'
  > = localInterlinearBibleResourceAccess
): BibleContentAccess => {
  const loadConfiguredStrongBibleChapterSpans = async (
    versionId: StrongBibleVersionId,
    book: number,
    chapter: number
  ) => {
    const result = await strongBibleAccess.loadChapterSpans({
      currentVersionId: versionId,
      defaultVersionId: versionId,
      fallbackVersionIds: [],
      book,
      chapter,
    })
    if (result.status !== 'available') {
      throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
    }
    return result
  }

  return {
    ...localBibleContentAccess,
    loadChapter: request =>
      loadBibleContentChapter(request, {
        ...defaultDependencies,
        chapterAdapter,
        loadStrongBibleChapterSpans: async (versionId, book, chapter) => {
          const result = await loadConfiguredStrongBibleChapterSpans(versionId, book, chapter)
          return {
            spansByVerse: result.spansByVerse,
            ...(result.textRevision ? { textRevision: result.textRevision } : {}),
            ...(result.textSha256 ? { textSha256: result.textSha256 } : {}),
          }
        },
        loadReverseInterlinearChapterSpans: loadConfiguredStrongBibleChapterSpans,
        loadInterlinearChapterTokens: async (_versionId, locale, book, chapter) =>
          (
            await interlinearBibleAccess.loadChapterTokens(locale, {
              book,
              chapter,
            })
          ).tokensByVerse,
        getInterlinearAvailability: interlinearBibleAccess.getAvailability,
      }),
    loadVerseTexts: async ({ version, verseKeys, shouldCancel }) => {
      try {
        return await loadVerseTextsFromChapterAdapter(
          chapterAdapter,
          version,
          verseKeys,
          shouldCancel
        )
      } catch (error) {
        if (error instanceof BibleVerseTextSourceError) {
          if (error.diagnostics) {
            throw resourceAccessErrorFromBibleChapterUnavailable(
              error.reason,
              error.recoveries,
              error.diagnostics
            )
          }
          throw new BibleLoadingError(unavailableReasonToErrorType(error.reason), version)
        }
        throw error
      }
    },
    loadCoverage: async version => {
      const result = await chapterAdapter.loadCoverage(version)
      if (result.status === 'available') return result.coverage
      if (result.diagnostics) {
        throw resourceAccessErrorFromBibleChapterUnavailable(
          result.reason,
          undefined,
          result.diagnostics
        )
      }
      throw new BibleLoadingError(unavailableReasonToErrorType(result.reason), version)
    },
  }
}
