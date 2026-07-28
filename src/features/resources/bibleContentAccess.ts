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
import { localStrongAccess, type StrongAccess } from './strongAccess'
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
import { resolveDisplayedStrongIdentities } from '~helpers/strongIdentities'

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
  strongMode?: StrongMode
  interlinearMode?: InterlinearMode
  interlinearLocale?: ResourceLanguage
  interlinearLocaleAutomatic?: boolean
}

export type BibleContentAccess = {
  loadChapter: (request: BibleChapterRequest) => Promise<BibleChapterResult<BibleChapterData>>
  loadChapterVerses: typeof getChapterVerses
  loadVerseText: typeof getVerseText
}

type BibleContentAccessDependencies = {
  loadInterlinearChapter: typeof loadInterlineaireChapter
  strongAccess: Pick<StrongAccess, 'loadReferences'>
  getChapterVerses: typeof getChapterVerses
  getIfVersionNeedsDownload: typeof getIfVersionNeedsDownload
  logError: (message: string, error: unknown) => void
  loadStrongBibleChapterSpans?: typeof loadStrongBibleChapterSpans
  loadReverseInterlinearChapterSpans?: typeof loadReverseInterlinearChapterSpans
  loadInterlinearChapterTokens?: typeof loadInterlinearChapterTokens
}

const defaultDependencies: BibleContentAccessDependencies = {
  loadInterlinearChapter: loadInterlineaireChapter,
  strongAccess: localStrongAccess,
  getChapterVerses,
  getIfVersionNeedsDownload,
  logError: (message, error) => console.log(message, error),
  loadStrongBibleChapterSpans,
  loadReverseInterlinearChapterSpans,
  loadInterlinearChapterTokens,
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

const loadRegularBibleChapter = async (
  request: BibleChapterRequest,
  dependencies: BibleContentAccessDependencies
): Promise<BibleChapterResult<BibleChapterData>> => {
  const verses = await dependencies.getChapterVerses(request.version, request.book, request.chapter)
  if (verses.length === 0) {
    return errorResult(await buildNoVersesError(request, dependencies))
  }

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
        return successResult(
          verses.map(verse => ({
            ...verse,
            InterlinearTokens: tokensByVerse[Number(verse.Verset)] ?? [],
          }))
        )
      } catch (error) {
        dependencies.logError(
          `[BibleContentAccess] Interlinear ${locale} sidecar unavailable:`,
          error
        )
      }
    }
    return successResult(verses)
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
        dependencies.getChapterVerses('BHG', request.book, request.chapter),
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
        originalVerses.map(verse => [Number(verse.Verset), verse.Texte] as const)
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
          const loadedEntries = await dependencies.strongAccess.loadReferences(
            fallbackReferences,
            request.book
          )
          if (Array.isArray(loadedEntries)) {
            lexicalEntries = loadedEntries.flatMap(entry => {
              if (
                typeof entry !== 'object' ||
                entry == null ||
                !('Code' in entry) ||
                !('Phonetique' in entry)
              ) {
                return []
              }
              const Hebreu =
                'Hebreu' in entry && typeof entry.Hebreu === 'string' ? entry.Hebreu : ''
              const Grec = 'Grec' in entry && typeof entry.Grec === 'string' ? entry.Grec : ''
              if (!Hebreu && !Grec) return []
              return [
                {
                  Code: entry.Code as string | number,
                  Hebreu,
                  Grec,
                  Phonetique: String(entry.Phonetique ?? ''),
                },
              ]
            })
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
          }
        } catch (error) {
          dependencies.logError('[BibleContentAccess] Strong lexical fallback unavailable:', error)
        }
      }

      return successResult(
        verses.map(verse => ({
          ...verse,
          ReverseInterlinearSpans: reverseSpansByVerse[Number(verse.Verset)] ?? [],
        }))
      )
    } catch (error) {
      dependencies.logError('[BibleContentAccess] Reverse interlinear unavailable:', error)
      return successResult(verses)
    }
  }

  if (
    request.strongMode !== 'visible' ||
    !isStrongCapableBibleVersion(request.version) ||
    !dependencies.loadStrongBibleChapterSpans
  ) {
    return successResult(verses)
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
    return successResult(
      verses.map(verse => {
        const alignedTokens = alignedTokensByVerse[verse.Verset] ?? []
        const alignedTokensById = new Map(
          alignedTokens.flatMap(token => (token.id == null ? [] : [[token.id, token] as const]))
        )
        return {
          ...verse,
          StrongSpans: (spansByVerse[verse.Verset] ?? []).map(span => ({
            ...span,
            identities: resolveDisplayedStrongIdentities(
              span.identities,
              (span.stepTokenIds ?? []).flatMap(
                tokenId =>
                  alignedTokensById.get(tokenId)?.segments.flatMap(segment => segment.identities) ??
                  []
              )
            ),
          })),
        }
      })
    )
  } catch (error) {
    dependencies.logError('[BibleContentAccess] Strong sidecar unavailable:', error)
    return successResult(verses)
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
    if (normalizedRequest.version === 'INT') {
      return await loadInterlinearBibleChapter(normalizedRequest, 'fr', dependencies)
    }

    if (normalizedRequest.version === 'INT_EN') {
      return await loadInterlinearBibleChapter(normalizedRequest, 'en', dependencies)
    }

    return await loadRegularBibleChapter(normalizedRequest, dependencies)
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
