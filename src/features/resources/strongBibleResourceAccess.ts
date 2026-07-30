import type { Verse } from '~common/types'
import { getMultipleVerses, getVerseText } from '~helpers/biblesDb'
import type { StrongBibleSpan } from '~helpers/canonicalStrongVerse'
import {
  getStrongBibleSidecarAvailability,
  getResolvedStrongBibleConcordanceIdentity,
  loadStrongBibleChapterSpans,
  loadStrongBibleLemmaStats,
  loadStrongBibleOccurrenceLocations,
  loadStrongBibleVerseCountsByBook,
  loadStrongBibleVerseSpans,
  type StrongBibleOccurrenceLocation,
  type StrongBibleOccurrencePage,
  type StrongBibleLemmaStat,
  type ResolvedStrongBibleIdentity,
  type StrongBibleSidecarAvailability,
  type StrongBibleVerseCountByBook,
} from '~helpers/strongBibleSidecar'
import {
  getStrongBibleFallbackPriority,
  isStrongCapableBibleVersion,
  resolveStrongBibleVersion,
  type StrongBibleDatasetId,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'

export interface StrongBibleProvenance {
  versionId: StrongBibleVersionId
  datasetId: StrongBibleDatasetId
  isFallback: boolean
}

export interface StrongBibleResolutionRequest {
  currentVersionId: string
  defaultVersionId: StrongBibleVersionId
  preferredVersionId?: StrongBibleVersionId
  fallbackVersionIds?: readonly StrongBibleVersionId[]
}

export interface StrongBibleVerseRequest extends StrongBibleResolutionRequest {
  book: number
  chapter: number
  verse: number
}

export interface StrongBibleConcordanceRequest extends StrongBibleResolutionRequest {
  book: number
  reference: string | number
  limit?: number
  offset?: number
  allBooks?: boolean
  lexemeId?: number
}

export type StrongBibleAttempt = {
  versionId: string
  status: StrongBibleSidecarAvailability['status']
}

type StrongBibleUnavailable = {
  status: 'unavailable'
  attempts: StrongBibleAttempt[]
}

type StrongBibleMissingLocation = {
  status: 'missing-location'
  provenance: StrongBibleProvenance
}

export type StrongBibleVerseResult =
  | StrongBibleUnavailable
  | StrongBibleMissingLocation
  | {
      status: 'available'
      provenance: StrongBibleProvenance
      verse: Verse
    }

export type StrongBibleCountsResult =
  | StrongBibleUnavailable
  | {
      status: 'available'
      provenance: StrongBibleProvenance
      counts: StrongBibleVerseCountByBook[]
      identity?: ResolvedStrongBibleIdentity
    }

export type StrongBibleFoundVersesResult =
  | StrongBibleUnavailable
  | {
      status: 'available'
      provenance: StrongBibleProvenance
      verses: Verse[]
      identity?: ResolvedStrongBibleIdentity
    }

export type StrongBibleLemmaStatsResult =
  | StrongBibleUnavailable
  | {
      status: 'available'
      provenance: StrongBibleProvenance
      lemmas: StrongBibleLemmaStat[]
      identity?: ResolvedStrongBibleIdentity
    }

export interface StrongBibleResourceDependencies {
  getAvailability: (versionId: string) => Promise<StrongBibleSidecarAvailability>
  getVerseText: (
    versionId: string,
    book: number,
    chapter: number,
    verse: number
  ) => Promise<string | null>
  getVerseSpans: (
    versionId: StrongBibleVersionId,
    book: number,
    chapter: number,
    verse: number
  ) => Promise<StrongBibleSpan[]>
  getChapterSpans: (
    versionId: StrongBibleVersionId,
    book: number,
    chapter: number
  ) => Promise<Record<number, StrongBibleSpan[]>>
  getCountsByBook: (
    versionId: StrongBibleVersionId,
    book: number,
    reference: string | number
  ) => Promise<StrongBibleVerseCountByBook[]>
  getResolvedIdentity: (
    versionId: StrongBibleVersionId,
    book: number,
    reference: string | number
  ) => Promise<ResolvedStrongBibleIdentity | undefined>
  getFoundVerseLocations: (
    versionId: StrongBibleVersionId,
    book: number,
    reference: string | number,
    page?: StrongBibleOccurrencePage
  ) => Promise<StrongBibleOccurrenceLocation[]>
  getLemmaStats: (
    versionId: StrongBibleVersionId,
    book: number,
    reference: string | number
  ) => Promise<StrongBibleLemmaStat[]>
  getMultipleVerses: (versionId: string, verseKeys: string[]) => Promise<Record<string, string>>
}

export interface StrongBibleResourceAccess {
  loadVerse: (request: StrongBibleVerseRequest) => Promise<StrongBibleVerseResult>
  loadCountsByBook: (request: StrongBibleConcordanceRequest) => Promise<StrongBibleCountsResult>
  loadFoundVersesByBook: (
    request: StrongBibleConcordanceRequest
  ) => Promise<StrongBibleFoundVersesResult>
  loadLemmaStats: (request: StrongBibleConcordanceRequest) => Promise<StrongBibleLemmaStatsResult>
}

const defaultDependencies: StrongBibleResourceDependencies = {
  getAvailability: getStrongBibleSidecarAvailability,
  getVerseText,
  getVerseSpans: loadStrongBibleVerseSpans,
  getChapterSpans: loadStrongBibleChapterSpans,
  getCountsByBook: loadStrongBibleVerseCountsByBook,
  getResolvedIdentity: getResolvedStrongBibleConcordanceIdentity,
  getFoundVerseLocations: loadStrongBibleOccurrenceLocations,
  getLemmaStats: loadStrongBibleLemmaStats,
  getMultipleVerses,
}

export const createStrongBibleResourceAccess = (
  dependencies: StrongBibleResourceDependencies = defaultDependencies
): StrongBibleResourceAccess => {
  const resolve = async (
    request: StrongBibleResolutionRequest
  ): Promise<
    | StrongBibleUnavailable
    | {
        status: 'available'
        provenance: StrongBibleProvenance
      }
  > => {
    const currentVersionId = resolveStrongBibleVersion(request.currentVersionId).versionId
    const languagePriority = getStrongBibleFallbackPriority(currentVersionId)
    const fallbackVersionIds = request.fallbackVersionIds ?? languagePriority
    const candidates = [
      ...new Set([
        request.preferredVersionId,
        currentVersionId,
        request.defaultVersionId,
        ...fallbackVersionIds,
      ]),
    ].filter((candidate): candidate is string => Boolean(candidate))
    const attempts: StrongBibleAttempt[] = []

    for (const candidate of candidates) {
      if (!isStrongCapableBibleVersion(candidate)) {
        attempts.push({ versionId: candidate, status: 'unsupported' })
        continue
      }
      const availability = await dependencies.getAvailability(candidate)
      if (availability.status === 'available') {
        return {
          status: 'available',
          provenance: {
            versionId: candidate,
            datasetId: availability.datasetId as StrongBibleDatasetId,
            isFallback: candidate !== currentVersionId,
          },
        }
      }
      attempts.push({ versionId: candidate, status: availability.status })
    }

    return { status: 'unavailable', attempts }
  }

  return {
    async loadVerse(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      const { versionId } = resolution.provenance
      const [text, spans] = await Promise.all([
        dependencies.getVerseText(versionId, request.book, request.chapter, request.verse),
        dependencies.getVerseSpans(versionId, request.book, request.chapter, request.verse),
      ])
      if (text == null) {
        return { status: 'missing-location', provenance: resolution.provenance }
      }
      return {
        status: 'available',
        provenance: resolution.provenance,
        verse: {
          Livre: request.book,
          Chapitre: request.chapter,
          Verset: request.verse,
          Texte: text,
          StrongSpans: spans,
        },
      }
    },

    async loadCountsByBook(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      const [counts, identity] = await Promise.all([
        dependencies.getCountsByBook(
          resolution.provenance.versionId,
          request.book,
          request.reference
        ),
        dependencies.getResolvedIdentity(
          resolution.provenance.versionId,
          request.book,
          request.reference
        ),
      ])
      return {
        status: 'available',
        provenance: resolution.provenance,
        counts,
        ...(identity ? { identity } : {}),
      }
    },

    async loadFoundVersesByBook(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      const { versionId } = resolution.provenance
      const [locations, identity] = await Promise.all([
        dependencies.getFoundVerseLocations(versionId, request.book, request.reference, {
          limit: request.limit,
          offset: request.offset,
          allBooks: request.allBooks,
          lexemeId: request.lexemeId,
        }),
        dependencies.getResolvedIdentity(versionId, request.book, request.reference),
      ])
      const keys = locations.map(
        location => `${location.Livre}-${location.Chapitre}-${location.Verset}`
      )
      const texts = await dependencies.getMultipleVerses(versionId, keys)
      const chapters = [
        ...new Map(
          locations.map(location => [
            `${location.Livre}-${location.Chapitre}`,
            { book: location.Livre, chapter: location.Chapitre },
          ])
        ).values(),
      ]
      const chapterSpans = new Map<string, Record<number, StrongBibleSpan[]>>(
        await Promise.all(
          chapters.map(
            async ({ book, chapter }) =>
              [
                `${book}-${chapter}`,
                await dependencies.getChapterSpans(versionId, book, chapter),
              ] as const
          )
        )
      )
      const verses: Verse[] = []
      for (const location of locations) {
        const key = `${location.Livre}-${location.Chapitre}-${location.Verset}`
        const text = texts[key]
        if (text == null) continue
        const spans =
          chapterSpans.get(`${location.Livre}-${location.Chapitre}`)?.[location.Verset] ?? []
        verses.push({
          ...location,
          Texte: text,
          StrongSpans: spans,
        })
      }
      return {
        status: 'available',
        provenance: resolution.provenance,
        verses,
        ...(identity ? { identity } : {}),
      }
    },

    async loadLemmaStats(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      const [lemmas, identity] = await Promise.all([
        dependencies.getLemmaStats(
          resolution.provenance.versionId,
          request.book,
          request.reference
        ),
        dependencies.getResolvedIdentity(
          resolution.provenance.versionId,
          request.book,
          request.reference
        ),
      ])
      return {
        status: 'available',
        provenance: resolution.provenance,
        lemmas,
        ...(identity ? { identity } : {}),
      }
    },
  }
}

export const localStrongBibleResourceAccess = createStrongBibleResourceAccess()
