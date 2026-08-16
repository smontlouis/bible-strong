import type { Verse } from '~common/types'
import { getMultipleVerses, getVerseText } from '~helpers/biblesDb'
import type { StrongBibleSpan } from '~helpers/canonicalStrongVerse'
import {
  getStrongBibleSidecarAvailability,
  getResolvedStrongBibleConcordanceIdentity,
  loadStrongBibleLemmaStats,
  loadStrongBibleChapterSpans,
  loadStrongBibleOccurrenceLocations,
  loadStrongBibleVerseCountsByBook,
  loadStrongBibleVerseSpans,
  loadStrongBibleVersesSpans,
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

export type { StrongBibleLemmaStat, StrongBibleVerseCountByBook } from '~helpers/strongBibleSidecar'

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

export interface StrongBibleChapterRequest extends StrongBibleResolutionRequest {
  book: number
  chapter: number
}

export interface StrongBibleConcordanceRequest extends StrongBibleResolutionRequest {
  book: number
  reference: string | number
  limit?: number
  pageToken?: string
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

export type StrongBibleChapterCodesResult =
  | StrongBibleUnavailable
  | {
      status: 'available'
      provenance: StrongBibleProvenance
      codes: string[]
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
      nextPageToken?: string
    }

export type StrongBibleLemmaStatsResult =
  | StrongBibleUnavailable
  | {
      status: 'available'
      provenance: StrongBibleProvenance
      lemmas: StrongBibleLemmaStat[]
      identity?: ResolvedStrongBibleIdentity
    }

export interface StrongBibleResourceAdapter {
  getAvailability: (versionId: string) => Promise<StrongBibleSidecarAvailability>
  loadVerse: (
    versionId: StrongBibleVersionId,
    request: Pick<StrongBibleVerseRequest, 'book' | 'chapter' | 'verse'>
  ) => Promise<{ text: string; spans: StrongBibleSpan[] } | undefined>
  loadChapterSpans: (
    versionId: StrongBibleVersionId,
    request: Pick<StrongBibleChapterRequest, 'book' | 'chapter'>
  ) => Promise<Record<number, StrongBibleSpan[]>>
  loadCountsByBook: (
    versionId: StrongBibleVersionId,
    request: StrongBibleAdapterConcordanceRequest
  ) => Promise<{
    counts: StrongBibleVerseCountByBook[]
    identity?: ResolvedStrongBibleIdentity
  }>
  loadFoundVersesByBook: (
    versionId: StrongBibleVersionId,
    request: StrongBibleAdapterConcordanceRequest
  ) => Promise<{
    verses: Verse[]
    identity?: ResolvedStrongBibleIdentity
    nextOffset?: number
  }>
  loadLemmaStats: (
    versionId: StrongBibleVersionId,
    request: StrongBibleAdapterConcordanceRequest
  ) => Promise<{
    lemmas: StrongBibleLemmaStat[]
    identity?: ResolvedStrongBibleIdentity
  }>
}

type StrongBibleAdapterConcordanceRequest = Omit<StrongBibleConcordanceRequest, 'pageToken'> & {
  offset?: number
}

const encodePageToken = (offset: number) => `strong:${offset}`

const decodePageToken = (pageToken?: string) => {
  if (!pageToken?.startsWith('strong:')) return 0
  const offset = Number(pageToken.slice('strong:'.length))
  return Number.isFinite(offset) && offset >= 0 ? offset : 0
}

const toAdapterRequest = (
  request: StrongBibleConcordanceRequest
): StrongBibleAdapterConcordanceRequest => {
  const { pageToken, ...adapterRequest } = request
  return { ...adapterRequest, offset: decodePageToken(pageToken) }
}

export interface StrongBibleResourceAccess {
  getAvailability: (versionId: string) => Promise<StrongBibleSidecarAvailability>
  loadVerse: (request: StrongBibleVerseRequest) => Promise<StrongBibleVerseResult>
  loadChapterCodes: (request: StrongBibleChapterRequest) => Promise<StrongBibleChapterCodesResult>
  loadCountsByBook: (request: StrongBibleConcordanceRequest) => Promise<StrongBibleCountsResult>
  loadFoundVersesByBook: (
    request: StrongBibleConcordanceRequest
  ) => Promise<StrongBibleFoundVersesResult>
  loadLemmaStats: (request: StrongBibleConcordanceRequest) => Promise<StrongBibleLemmaStatsResult>
}

export const localStrongBibleResourceAdapter: StrongBibleResourceAdapter = {
  getAvailability: getStrongBibleSidecarAvailability,
  loadChapterSpans(versionId, request) {
    return loadStrongBibleChapterSpans(versionId, request.book, request.chapter)
  },
  async loadVerse(versionId, request) {
    const [text, spans] = await Promise.all([
      getVerseText(versionId, request.book, request.chapter, request.verse),
      loadStrongBibleVerseSpans(versionId, request.book, request.chapter, request.verse),
    ])
    return text == null ? undefined : { text, spans }
  },
  async loadCountsByBook(versionId, request) {
    const [counts, identity] = await Promise.all([
      loadStrongBibleVerseCountsByBook(versionId, request.book, request.reference),
      getResolvedStrongBibleConcordanceIdentity(versionId, request.book, request.reference),
    ])
    return { counts, ...(identity ? { identity } : {}) }
  },
  async loadFoundVersesByBook(versionId, request) {
    const [locations, identity] = await Promise.all([
      loadStrongBibleOccurrenceLocations(versionId, request.book, request.reference, {
        limit: request.limit,
        offset: request.offset,
        allBooks: request.allBooks,
        lexemeId: request.lexemeId,
      }),
      getResolvedStrongBibleConcordanceIdentity(versionId, request.book, request.reference),
    ])
    const keys = locations.map(
      location => `${location.Livre}-${location.Chapitre}-${location.Verset}`
    )
    const [texts, spansByVerse] = await Promise.all([
      getMultipleVerses(versionId, keys),
      loadStrongBibleVersesSpans(versionId, locations),
    ])
    const verses = locations.flatMap(location => {
      const key = `${location.Livre}-${location.Chapitre}-${location.Verset}`
      const text = texts[key]
      return text == null
        ? []
        : [{ ...location, Texte: text, StrongSpans: spansByVerse[key] ?? [] }]
    })
    const nextOffset =
      request.limit && locations.length >= request.limit
        ? (request.offset ?? 0) + locations.length
        : undefined
    return {
      verses,
      ...(identity ? { identity } : {}),
      ...(nextOffset == null ? {} : { nextOffset }),
    }
  },
  async loadLemmaStats(versionId, request) {
    const [lemmas, identity] = await Promise.all([
      loadStrongBibleLemmaStats(versionId, request.book, request.reference),
      getResolvedStrongBibleConcordanceIdentity(versionId, request.book, request.reference),
    ])
    return { lemmas, ...(identity ? { identity } : {}) }
  },
}

export const createStrongBibleResourceAccess = (
  adapter: StrongBibleResourceAdapter = localStrongBibleResourceAdapter
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
      const availability = await adapter.getAvailability(candidate)
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
    getAvailability: adapter.getAvailability,
    async loadChapterCodes(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      const spansByVerse = await adapter.loadChapterSpans(resolution.provenance.versionId, {
        book: request.book,
        chapter: request.chapter,
      })
      return {
        status: 'available',
        provenance: resolution.provenance,
        codes: [
          ...new Set(
            Object.values(spansByVerse).flatMap(spans =>
              spans.flatMap(span => span.identities.map(identity => identity.code))
            )
          ),
        ],
      }
    },

    async loadVerse(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      const { versionId } = resolution.provenance
      const loaded = await adapter.loadVerse(versionId, request)
      if (!loaded) {
        return { status: 'missing-location', provenance: resolution.provenance }
      }
      return {
        status: 'available',
        provenance: resolution.provenance,
        verse: {
          Livre: request.book,
          Chapitre: request.chapter,
          Verset: request.verse,
          Texte: loaded.text,
          StrongSpans: loaded.spans,
        },
      }
    },

    async loadCountsByBook(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      const loaded = await adapter.loadCountsByBook(
        resolution.provenance.versionId,
        toAdapterRequest(request)
      )
      return {
        status: 'available',
        provenance: resolution.provenance,
        counts: loaded.counts,
        ...(loaded.identity ? { identity: loaded.identity } : {}),
      }
    },

    async loadFoundVersesByBook(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      const { versionId } = resolution.provenance
      const loaded = await adapter.loadFoundVersesByBook(versionId, toAdapterRequest(request))
      return {
        status: 'available',
        provenance: resolution.provenance,
        verses: loaded.verses,
        ...(loaded.identity ? { identity: loaded.identity } : {}),
        ...(loaded.nextOffset == null ? {} : { nextPageToken: encodePageToken(loaded.nextOffset) }),
      }
    },

    async loadLemmaStats(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      const loaded = await adapter.loadLemmaStats(
        resolution.provenance.versionId,
        toAdapterRequest(request)
      )
      return {
        status: 'available',
        provenance: resolution.provenance,
        lemmas: loaded.lemmas,
        ...(loaded.identity ? { identity: loaded.identity } : {}),
      }
    },
  }
}

export const localStrongBibleResourceAccess = createStrongBibleResourceAccess()
