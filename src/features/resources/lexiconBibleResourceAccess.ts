import type { Verse } from '~common/types'
import { getMultipleVerses, getVerseText } from '~helpers/biblesDb'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getInterlinearLocalePriority } from '~helpers/interlinearBiblePublications'
import {
  getInterlinearSidecarAvailability,
  loadInterlinearStrongOccurrencePage,
  loadInterlinearStrongVerseCountsByBook,
  loadInterlinearVerseTokens,
  type InterlinearSidecarAvailability,
  type InterlinearToken,
} from '~helpers/interlinearBibleSidecar'
import { getDisplayedStrongIdentities } from '~helpers/strongIdentities'
import type { StrongBibleSpan } from '~helpers/canonicalStrongVerse'
import {
  localStrongBibleResourceAccess,
  type StrongBibleResourceAccess,
  type StrongBibleConcordanceRequest,
  type StrongBibleCountsResult,
  type StrongBibleFoundVersesResult,
  type StrongBibleLemmaStatsResult,
  type StrongBibleVerseRequest,
  type StrongBibleVerseResult,
} from './strongBibleResourceAccess'

export type BhgLexiconProvenance = {
  sourceKind: 'interlinear'
  versionId: 'BHG'
  datasetId: 'STEP'
  locale: ResourceLanguage
  isFallback: false
}

export type LexiconBibleProvenance =
  | BhgLexiconProvenance
  | Extract<StrongBibleVerseResult, { status: 'available' }>['provenance']

export type LexiconBibleVerseResult =
  | Exclude<StrongBibleVerseResult, { status: 'available' }>
  | {
      status: 'available'
      provenance: LexiconBibleProvenance
      verse: Verse
    }

export interface LexiconBibleVerseRequest extends StrongBibleVerseRequest {
  preferredInterlinearLocale: ResourceLanguage
}

export interface LexiconBibleConcordanceRequest extends StrongBibleConcordanceRequest {
  preferredInterlinearLocale: ResourceLanguage
  cursor?: string
}

export type BhgLexiconAvailability =
  | {
      status: 'available'
      locale: ResourceLanguage
    }
  | {
      status: 'unavailable'
      attempts: {
        locale: ResourceLanguage
        status: InterlinearSidecarAvailability['status']
      }[]
    }

export interface LexiconBibleResourceDependencies {
  strongBible: StrongBibleResourceAccess
  getInterlinearAvailability: (locale: ResourceLanguage) => Promise<InterlinearSidecarAvailability>
  loadInterlinearVerseTokens: (
    versionId: 'BHG',
    locale: ResourceLanguage,
    book: number,
    chapter: number,
    verse: number
  ) => Promise<InterlinearToken[]>
  loadInterlinearStrongOccurrencePage: typeof loadInterlinearStrongOccurrencePage
  loadInterlinearStrongVerseCountsByBook: typeof loadInterlinearStrongVerseCountsByBook
  getMultipleVerses: typeof getMultipleVerses
  getVerseText: (
    versionId: string,
    book: number,
    chapter: number,
    verse: number
  ) => Promise<string | null>
}

export interface LexiconBibleResourceAccess {
  loadVerse: (request: LexiconBibleVerseRequest) => Promise<LexiconBibleVerseResult>
  loadCountsByBook: (
    request: LexiconBibleConcordanceRequest
  ) => Promise<StrongBibleCountsResult | BhgLexiconCountsResult>
  loadFoundVersesByBook: (
    request: LexiconBibleConcordanceRequest
  ) => Promise<StrongBibleFoundVersesResult | BhgLexiconFoundVersesResult>
  loadLemmaStats: (
    request: LexiconBibleConcordanceRequest
  ) => Promise<StrongBibleLemmaStatsResult | BhgLexiconLemmaStatsResult>
}

type BhgLexiconCountsResult = {
  status: 'available'
  provenance: BhgLexiconProvenance
  counts: Awaited<ReturnType<typeof loadInterlinearStrongVerseCountsByBook>>
}

type BhgLexiconFoundVersesResult = {
  status: 'available'
  provenance: BhgLexiconProvenance
  verses: Verse[]
  nextCursor?: string
}

type BhgLexiconLemmaStatsResult = {
  status: 'available'
  provenance: BhgLexiconProvenance
  lemmas: []
}

const defaultDependencies: LexiconBibleResourceDependencies = {
  strongBible: localStrongBibleResourceAccess,
  getInterlinearAvailability: getInterlinearSidecarAvailability,
  loadInterlinearVerseTokens,
  loadInterlinearStrongOccurrencePage,
  loadInterlinearStrongVerseCountsByBook,
  getMultipleVerses,
  getVerseText,
}

const resolveBhgAvailability = async (
  preferredLocale: ResourceLanguage,
  getAvailability: LexiconBibleResourceDependencies['getInterlinearAvailability']
): Promise<BhgLexiconAvailability> => {
  const attempts: Extract<BhgLexiconAvailability, { status: 'unavailable' }>['attempts'] = []

  for (const locale of getInterlinearLocalePriority(preferredLocale)) {
    const availability = await getAvailability(locale)
    if (availability.status === 'available') return { status: 'available', locale }
    attempts.push({ locale, status: availability.status })
  }

  return { status: 'unavailable', attempts }
}

export const getBhgLexiconAvailability = (
  preferredLocale: ResourceLanguage
): Promise<BhgLexiconAvailability> =>
  resolveBhgAvailability(preferredLocale, getInterlinearSidecarAvailability)

export const createBhgStrongSpans = (tokens: InterlinearToken[]): StrongBibleSpan[] =>
  tokens.flatMap(token => {
    const identities = getDisplayedStrongIdentities(
      token.segments.flatMap(segment => segment.identities)
    )
    if (!identities.length) return []

    return [
      {
        ordinal: token.ordinal,
        startOffset: token.startOffset,
        length: token.length,
        identities: identities.map(identity => ({ kind: identity.kind, code: identity.code })),
      },
    ]
  })

export const createLexiconBibleResourceAccess = (
  dependencies: LexiconBibleResourceDependencies = defaultDependencies
): LexiconBibleResourceAccess => {
  const resolveBhg = async (request: LexiconBibleConcordanceRequest) => {
    if (request.currentVersionId !== 'BHG' || request.preferredVersionId) return undefined
    const availability = await resolveBhgAvailability(
      request.preferredInterlinearLocale,
      dependencies.getInterlinearAvailability
    )
    return availability.status === 'available' ? availability.locale : undefined
  }

  const bhgProvenance = (locale: ResourceLanguage): BhgLexiconProvenance => ({
    sourceKind: 'interlinear',
    versionId: 'BHG',
    datasetId: 'STEP',
    locale,
    isFallback: false,
  })

  return {
    async loadVerse(request) {
      if (request.currentVersionId === 'BHG' && !request.preferredVersionId) {
        try {
          const availability = await resolveBhgAvailability(
            request.preferredInterlinearLocale,
            dependencies.getInterlinearAvailability
          )
          if (availability.status === 'available') {
            const [text, tokens] = await Promise.all([
              dependencies.getVerseText('BHG', request.book, request.chapter, request.verse),
              dependencies.loadInterlinearVerseTokens(
                'BHG',
                availability.locale,
                request.book,
                request.chapter,
                request.verse
              ),
            ])
            const spans = createBhgStrongSpans(tokens)
            if (text != null && spans.length) {
              return {
                status: 'available',
                provenance: {
                  sourceKind: 'interlinear',
                  versionId: 'BHG',
                  datasetId: 'STEP',
                  locale: availability.locale,
                  isFallback: false,
                },
                verse: {
                  Livre: request.book,
                  Chapitre: request.chapter,
                  Verset: request.verse,
                  Texte: text,
                  StrongSpans: spans,
                },
              }
            }
          }
        } catch {
          // A corrupt or unreadable contextual index must not block the traditional Strong fallback.
        }
      }

      return dependencies.strongBible.loadVerse(request)
    },

    async loadCountsByBook(request) {
      const locale = await resolveBhg(request)
      if (!locale) return dependencies.strongBible.loadCountsByBook(request)
      try {
        return {
          status: 'available',
          provenance: bhgProvenance(locale),
          counts: await dependencies.loadInterlinearStrongVerseCountsByBook(
            locale,
            request.reference
          ),
        }
      } catch {
        return dependencies.strongBible.loadCountsByBook(request)
      }
    },

    async loadFoundVersesByBook(request) {
      const locale = await resolveBhg(request)
      if (!locale) return dependencies.strongBible.loadFoundVersesByBook(request)
      try {
        const page = await dependencies.loadInterlinearStrongOccurrencePage(
          locale,
          request.reference,
          {
            book: request.allBooks ? undefined : request.book,
            limit: request.limit,
            cursor: request.cursor,
          }
        )
        const texts = await dependencies.getMultipleVerses(
          'BHG',
          page.occurrences.map(({ Livre, Chapitre, Verset }) => `${Livre}-${Chapitre}-${Verset}`)
        )
        return {
          status: 'available',
          provenance: bhgProvenance(locale),
          verses: page.occurrences.flatMap(({ tokens, ...location }) => {
            const key = `${location.Livre}-${location.Chapitre}-${location.Verset}`
            const text = texts[key]
            if (text == null) return []
            return [
              {
                ...location,
                Texte: text,
                StrongSpans: createBhgStrongSpans(tokens),
              },
            ]
          }),
          ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
        }
      } catch {
        return dependencies.strongBible.loadFoundVersesByBook(request)
      }
    },

    async loadLemmaStats(request) {
      const locale = await resolveBhg(request)
      if (!locale) return dependencies.strongBible.loadLemmaStats(request)
      return { status: 'available', provenance: bhgProvenance(locale), lemmas: [] }
    },
  }
}

export const localLexiconBibleResourceAccess = createLexiconBibleResourceAccess()
