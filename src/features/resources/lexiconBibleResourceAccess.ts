import type { Verse } from '~common/types'
import { getVerseText } from '~helpers/biblesDb'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getInterlinearLocalePriority } from '~helpers/interlinearBiblePublications'
import {
  getInterlinearSidecarAvailability,
  loadInterlinearChapterTokens,
  type InterlinearChapterTokens,
  type InterlinearSidecarAvailability,
  type InterlinearToken,
} from '~helpers/interlinearBibleSidecar'
import { getDisplayedStrongIdentities } from '~helpers/strongIdentities'
import type { StrongBibleSpan } from '~helpers/canonicalStrongVerse'
import {
  localStrongBibleResourceAccess,
  type StrongBibleResourceAccess,
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
  loadInterlinearChapterTokens: (
    versionId: 'BHG',
    locale: ResourceLanguage,
    book: number,
    chapter: number
  ) => Promise<InterlinearChapterTokens>
  getVerseText: (
    versionId: string,
    book: number,
    chapter: number,
    verse: number
  ) => Promise<string | null>
}

export interface LexiconBibleResourceAccess {
  loadVerse: (request: LexiconBibleVerseRequest) => Promise<LexiconBibleVerseResult>
}

const defaultDependencies: LexiconBibleResourceDependencies = {
  strongBible: localStrongBibleResourceAccess,
  getInterlinearAvailability: getInterlinearSidecarAvailability,
  loadInterlinearChapterTokens,
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
): LexiconBibleResourceAccess => ({
  async loadVerse(request) {
    if (request.currentVersionId === 'BHG' && !request.preferredVersionId) {
      try {
        const availability = await resolveBhgAvailability(
          request.preferredInterlinearLocale,
          dependencies.getInterlinearAvailability
        )
        if (availability.status === 'available') {
          const [text, tokensByVerse] = await Promise.all([
            dependencies.getVerseText('BHG', request.book, request.chapter, request.verse),
            dependencies.loadInterlinearChapterTokens(
              'BHG',
              availability.locale,
              request.book,
              request.chapter
            ),
          ])
          const spans = createBhgStrongSpans(tokensByVerse[request.verse] ?? [])
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
})

export const localLexiconBibleResourceAccess = createLexiconBibleResourceAccess()
