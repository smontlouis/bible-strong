import type { Verse } from '~common/types'
import { Schema } from 'effect'
import type { StrongBibleSpan } from '~helpers/canonicalStrongVerse'
import type {
  StrongBibleLemmaStat,
  ResolvedStrongBibleIdentity,
  StrongBibleSidecarAvailability,
  StrongBibleVerseCountByBook,
} from '~helpers/strongBibleSidecar'
import {
  getStrongDatasetId,
  getStrongBibleFallbackPriority,
  isStrongCapableBibleVersion,
  resolveStrongBibleVersion,
  type StrongBibleDatasetId,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import { getStrongBibleConcordanceCandidates } from '~helpers/strongBibleConcordance'
import { STRONG_IDENTITY_KINDS } from '~helpers/strongIdentities'
import {
  StrongBibleChapterDto,
  StrongBibleCountsDto,
  StrongBibleCoverageDto,
  StrongBibleLemmaStatsDto,
  StrongBibleOccurrencesDto,
} from './strongBibleContract'
import type { BibleChapterAdapter } from './bibleChapterSource'
import { loadVerseTextsFromChapterAdapter } from './bibleChapterSource'
import {
  mapLocalResourceError,
  ResourceAccessError,
  resourceAccessErrorFromBibleChapterUnavailable,
  resourceAccessErrorFromHttpResponse,
} from './resourceAccessError'
import { warnAboutRecoverableResourceIntegrity } from './recoverableIntegrity'

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
  expectedTextRevision?: string
  expectedTextSha256?: string
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

export type StrongBibleChapterSpansResult =
  | StrongBibleUnavailable
  | {
      status: 'available'
      provenance: StrongBibleProvenance
      spansByVerse: Record<number, StrongBibleSpan[]>
      textRevision?: string
      textSha256?: string
    }

export type StrongBibleChapterSpansPayload = {
  spansByVerse: Record<number, StrongBibleSpan[]>
  textRevision?: string
  textSha256?: string
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
  ) => Promise<StrongBibleChapterSpansPayload>
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
    nextCursor?: string
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
  cursor?: string
}

const toAdapterRequest = (
  request: StrongBibleConcordanceRequest
): StrongBibleAdapterConcordanceRequest => {
  const { pageToken, ...adapterRequest } = request
  return { ...adapterRequest, ...(pageToken ? { cursor: pageToken } : {}) }
}

export interface StrongBibleResourceAccess {
  getAvailability: (versionId: string) => Promise<StrongBibleSidecarAvailability>
  loadVerse: (request: StrongBibleVerseRequest) => Promise<StrongBibleVerseResult>
  loadChapterCodes: (request: StrongBibleChapterRequest) => Promise<StrongBibleChapterCodesResult>
  loadChapterSpans: (request: StrongBibleChapterRequest) => Promise<StrongBibleChapterSpansResult>
  loadCountsByBook: (request: StrongBibleConcordanceRequest) => Promise<StrongBibleCountsResult>
  loadFoundVersesByBook: (
    request: StrongBibleConcordanceRequest
  ) => Promise<StrongBibleFoundVersesResult>
  loadLemmaStats: (request: StrongBibleConcordanceRequest) => Promise<StrongBibleLemmaStatsResult>
}

export const localStrongBibleResourceAdapter: StrongBibleResourceAdapter = {
  async getAvailability(versionId) {
    const { getStrongBibleSidecarAvailability } = await import('~helpers/strongBibleSidecar')
    return getStrongBibleSidecarAvailability(versionId)
  },
  async loadChapterSpans(versionId, request) {
    const { getStrongBibleSidecarAvailability, loadStrongBibleChapterSpans } =
      await import('~helpers/strongBibleSidecar')
    const [spansByVerse, availability] = await Promise.all([
      loadStrongBibleChapterSpans(versionId, request.book, request.chapter),
      getStrongBibleSidecarAvailability(versionId),
    ])
    return {
      spansByVerse,
      ...(availability.status === 'available'
        ? {
            textRevision: availability.textRevision,
            ...(availability.textSha256 ? { textSha256: availability.textSha256 } : {}),
          }
        : {}),
    }
  },
  async loadVerse(versionId, request) {
    const [{ getVerseText }, { loadStrongBibleVerseSpans }] = await Promise.all([
      import('~helpers/biblesDb'),
      import('~helpers/strongBibleSidecar'),
    ])
    const [text, spans] = await Promise.all([
      getVerseText(versionId, request.book, request.chapter, request.verse),
      loadStrongBibleVerseSpans(versionId, request.book, request.chapter, request.verse),
    ])
    return text == null ? undefined : { text, spans }
  },
  async loadCountsByBook(versionId, request) {
    const { loadStrongBibleVerseCountsByBookResult } = await import('~helpers/strongBibleSidecar')
    return loadStrongBibleVerseCountsByBookResult(versionId, request.book, request.reference)
  },
  async loadFoundVersesByBook(versionId, request) {
    const [strongBibleSidecar, biblesDb] = await Promise.all([
      import('~helpers/strongBibleSidecar'),
      import('~helpers/biblesDb'),
    ])
    const { loadStrongBibleOccurrenceLocations, loadStrongBibleVersesSpans } = strongBibleSidecar
    const { getMultipleVerses } = biblesDb
    const page = await loadStrongBibleOccurrenceLocations(
      versionId,
      request.book,
      request.reference,
      {
        limit: request.limit,
        cursor: request.cursor,
        allBooks: request.allBooks,
        lexemeId: request.lexemeId,
      }
    )
    const { locations, identity } = page
    const keys = locations.map(
      location => `${location.Livre}-${location.Chapitre}-${location.Verset}`
    )
    const [texts, spansByVerse] = await Promise.all([
      getMultipleVerses(versionId, keys),
      loadStrongBibleVersesSpans(versionId, locations),
    ])
    const missingTextCount = keys.filter(key => texts[key] === undefined).length
    const missingSpansCount = keys.filter(
      key => texts[key] !== undefined && (spansByVerse[key]?.length ?? 0) === 0
    ).length
    if (missingTextCount || missingSpansCount) {
      warnAboutRecoverableResourceIntegrity('strong-occurrences-incomplete', {
        versionId,
        book: request.book,
        reference: String(request.reference),
        missingTextCount,
        missingSpansCount,
      })
    }
    const verses = locations.flatMap(location => {
      const key = `${location.Livre}-${location.Chapitre}-${location.Verset}`
      const text = texts[key]
      return text == null
        ? []
        : [{ ...location, Texte: text, StrongSpans: spansByVerse[key] ?? [] }]
    })
    return {
      verses,
      ...(identity ? { identity } : {}),
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    }
  },
  async loadLemmaStats(versionId, request) {
    const { loadStrongBibleLemmaStatsResult } = await import('~helpers/strongBibleSidecar')
    return loadStrongBibleLemmaStatsResult(versionId, request.book, request.reference)
  },
}

type HttpStrongBibleResourceAdapterOptions = {
  baseUrl: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  bibleChapterAdapter: BibleChapterAdapter
  timeoutMs?: number
  availabilityStaleTimeMs?: number
  now?: () => number
}

const STRONG_BIBLE_AVAILABILITY_STALE_TIME_MS = 6 * 60 * 60 * 1000

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

const problemCode = (payload: unknown) =>
  payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined

const mapHttpFailure = async (
  response: Response,
  payload: unknown
): Promise<ResourceAccessError> => {
  const code = problemCode(payload)
  if (response.status === 404 && code === 'STRONG_BIBLE_CHAPTER_NOT_FOUND') {
    return resourceAccessErrorFromHttpResponse('NOT_FOUND', response, code)
  }
  if (response.status === 404 && code === 'STRONG_BIBLE_UNSUPPORTED') {
    return resourceAccessErrorFromHttpResponse('RESOURCE_UNSUPPORTED', response, code)
  }
  return resourceAccessErrorFromHttpResponse('TEMPORARY_UNAVAILABLE', response, code)
}

const toStrongBibleSpan = (
  span: StrongBibleChapterDto['verses'][number]['spans'][number]
): StrongBibleSpan => ({
  ordinal: span.ordinal,
  startOffset: span.startOffset,
  length: span.length,
  ...(span.stepTokenIds ? { stepTokenIds: [...span.stepTokenIds] } : {}),
  identities: span.identities.map(identity => ({ kind: identity.kind, code: identity.code })),
  ...(span.morphologies
    ? {
        morphologies: span.morphologies.map(morphology => ({
          identity: {
            kind: morphology.identity.kind,
            code: morphology.identity.code,
          },
          codes: [...morphology.codes],
        })),
      }
    : {}),
})

const hasBibleChapterRevisionMismatch = (
  chapter: Extract<
    Awaited<ReturnType<BibleChapterAdapter['loadChapter']>>,
    { status: 'available' }
  >,
  expectedTextRevision: string,
  expectedTextSha256: string
) =>
  chapter.textRevision !== expectedTextRevision ||
  chapter.textSha256 !== expectedTextSha256 ||
  chapter.verses.some(verse => verse.TextRevision !== expectedTextRevision)

const bibleChapterUnavailableError = (
  chapter: Extract<
    Awaited<ReturnType<BibleChapterAdapter['loadChapter']>>,
    { status: 'unavailable' }
  >
) =>
  resourceAccessErrorFromBibleChapterUnavailable(
    chapter.reason,
    chapter.recoveries,
    chapter.diagnostics
  )

export const createHttpStrongBibleResourceAdapter = ({
  baseUrl,
  fetcher = fetch,
  isOnline,
  bibleChapterAdapter,
  timeoutMs = 10_000,
  availabilityStaleTimeMs = STRONG_BIBLE_AVAILABILITY_STALE_TIME_MS,
  now = Date.now,
}: HttpStrongBibleResourceAdapterOptions): StrongBibleResourceAdapter => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const availabilityCache = new Map<
    string,
    { expiresAt: number; promise: Promise<StrongBibleSidecarAvailability> }
  >()
  const get = async <A>(path: string, schema: Schema.Schema<A>): Promise<A> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(`${normalizedBaseUrl}${path}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })
      const payload: unknown = await response.json().catch(() => undefined)
      if (!response.ok) throw await mapHttpFailure(response, payload)
      try {
        return Schema.decodeUnknownSync(schema)(payload)
      } catch {
        throw new ResourceAccessError('INTEGRITY_FAILURE')
      }
    } catch (error) {
      if (error instanceof ResourceAccessError) throw error
      throw new ResourceAccessError(
        (await isOnline()) ? 'TEMPORARY_UNAVAILABLE' : 'NETWORK_OFFLINE'
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  const assertPublicationIdentity = (
    resource: { versionId: string; datasetId: string },
    versionId: StrongBibleVersionId
  ) => {
    if (resource.versionId !== versionId || resource.datasetId !== getStrongDatasetId(versionId)) {
      throw new ResourceAccessError('INTEGRITY_FAILURE')
    }
  }

  const assertConcordanceIdentity = (
    identity: { kind: (typeof STRONG_IDENTITY_KINDS)[number]; code: string } | undefined,
    request: { book: number; reference: string | number }
  ) => {
    if (!identity) return
    const matchesRequest = getStrongBibleConcordanceCandidates(
      request.book,
      request.reference
    ).some(
      candidate =>
        candidate.code === identity.code && STRONG_IDENTITY_KINDS[candidate.kind] === identity.kind
    )
    if (!matchesRequest) throw new ResourceAccessError('INTEGRITY_FAILURE')
  }

  const loadChapter = async (versionId: StrongBibleVersionId, book: number, chapter: number) => {
    const response = await get(
      `/v1/strong-bibles/${encodeURIComponent(versionId)}/books/${book}/chapters/${chapter}`,
      StrongBibleChapterDto
    )
    assertPublicationIdentity(response.resource, versionId)
    if (response.book !== book || response.chapter !== chapter) {
      throw new ResourceAccessError('INTEGRITY_FAILURE')
    }
    return response
  }

  const loadAvailability = async (versionId: string): Promise<StrongBibleSidecarAvailability> => {
    if (!isStrongCapableBibleVersion(versionId)) return { status: 'unsupported' }
    try {
      const coverage = await get(
        `/v1/strong-bibles/${encodeURIComponent(versionId)}/coverage`,
        StrongBibleCoverageDto
      )
      assertPublicationIdentity(coverage.resource, versionId)
      const bibleCoverage = await bibleChapterAdapter.loadCoverage(versionId)
      if (bibleCoverage.status !== 'available') {
        throw bibleChapterUnavailableError(bibleCoverage)
      }
      if (
        bibleCoverage.textRevision !== coverage.resource.textRevision ||
        bibleCoverage.textSha256 !== coverage.resource.textSha256
      ) {
        warnAboutRecoverableResourceIntegrity('strong-bible-coverage-revision-mismatch', {
          versionId,
          bibleTextRevision: bibleCoverage.textRevision,
          strongTextRevision: coverage.resource.textRevision,
        })
      }
      return {
        status: 'available',
        versionId,
        datasetId: coverage.resource.datasetId,
        textRevision: coverage.resource.textRevision,
        textSha256: coverage.resource.textSha256,
        strongRevision: coverage.resource.strongRevision,
      }
    } catch (error) {
      if (error instanceof ResourceAccessError && error.code === 'RESOURCE_UNSUPPORTED') {
        return { status: 'unsupported' }
      }
      throw error
    }
  }

  const getAvailability = (versionId: string) => {
    const cached = availabilityCache.get(versionId)
    if (cached && cached.expiresAt > now()) return cached.promise

    const promise = loadAvailability(versionId).catch(error => {
      if (availabilityCache.get(versionId)?.promise === promise) {
        availabilityCache.delete(versionId)
      }
      throw error
    })
    availabilityCache.set(versionId, {
      expiresAt: now() + availabilityStaleTimeMs,
      promise,
    })
    return promise
  }

  return {
    getAvailability,
    async loadChapterSpans(versionId, request) {
      try {
        const chapter = await loadChapter(versionId, request.book, request.chapter)
        return {
          spansByVerse: Object.fromEntries(
            chapter.verses.map(verse => [verse.number, verse.spans.map(toStrongBibleSpan)])
          ),
          textRevision: chapter.resource.textRevision,
          textSha256: chapter.resource.textSha256,
        }
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NOT_FOUND') {
          return { spansByVerse: {} }
        }
        throw error
      }
    },
    async loadVerse(versionId, request) {
      try {
        const [chapter, bibleChapter] = await Promise.all([
          loadChapter(versionId, request.book, request.chapter),
          bibleChapterAdapter.loadChapter(versionId, request.book, request.chapter),
        ])
        if (bibleChapter.status !== 'available') throw bibleChapterUnavailableError(bibleChapter)
        if (
          hasBibleChapterRevisionMismatch(
            bibleChapter,
            chapter.resource.textRevision,
            chapter.resource.textSha256
          )
        ) {
          warnAboutRecoverableResourceIntegrity('strong-bible-text-revision-mismatch', {
            versionId,
            book: request.book,
            chapter: request.chapter,
            bibleTextRevision: bibleChapter.textRevision,
            strongTextRevision: chapter.resource.textRevision,
          })
        }
        const text = bibleChapter.verses.find(
          verse => Number(verse.Verset) === request.verse
        )?.Texte
        if (text == null) return undefined
        return {
          text,
          spans:
            chapter.verses
              .find(verse => verse.number === request.verse)
              ?.spans.map(toStrongBibleSpan) ?? [],
        }
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NOT_FOUND') return undefined
        throw error
      }
    },
    async loadCountsByBook(versionId, request) {
      const response = await get(
        `/v1/strong-bibles/${encodeURIComponent(versionId)}/books/${request.book}/identities/${encodeURIComponent(String(request.reference))}/counts`,
        StrongBibleCountsDto
      )
      assertPublicationIdentity(response.resource, versionId)
      assertConcordanceIdentity(response.identity, request)
      return {
        counts: response.counts.map(count => ({
          Livre: count.book,
          versesCountByBook: count.verseCount,
        })),
        ...(response.identity
          ? { identity: response.identity as ResolvedStrongBibleIdentity }
          : {}),
      }
    },
    async loadFoundVersesByBook(versionId, request) {
      const query = new URLSearchParams()
      if (request.limit !== undefined) query.set('limit', String(request.limit))
      if (request.cursor !== undefined) query.set('cursor', request.cursor)
      if (request.allBooks !== undefined) query.set('allBooks', String(request.allBooks))
      if (request.lexemeId !== undefined) query.set('lexemeId', String(request.lexemeId))
      const response = await get(
        `/v1/strong-bibles/${encodeURIComponent(versionId)}/books/${request.book}/identities/${encodeURIComponent(String(request.reference))}/occurrences${query.size ? `?${query}` : ''}`,
        StrongBibleOccurrencesDto
      )
      assertPublicationIdentity(response.resource, versionId)
      assertConcordanceIdentity(response.identity, request)
      const omittedVerseKeys: string[] = []
      const scopedVerses = response.verses.filter(verse => {
        if (request.allBooks === true || verse.book === request.book) return true
        omittedVerseKeys.push(`${verse.book}-${verse.chapter}-${verse.verse}`)
        return false
      })
      if (omittedVerseKeys.length) {
        warnAboutRecoverableResourceIntegrity('strong-occurrences-unrequested-books', {
          versionId,
          requestedBook: request.book,
          omittedVerseKeys,
        })
      }
      const verseKeys = scopedVerses.map(verse => `${verse.book}-${verse.chapter}-${verse.verse}`)
      const texts = await loadVerseTextsFromChapterAdapter(
        bibleChapterAdapter,
        versionId,
        verseKeys,
        undefined,
        response.resource.textRevision,
        response.resource.textSha256
      )
      const missingTextCount = verseKeys.filter(key => texts[key] === undefined).length
      const missingSpansCount = scopedVerses.filter(verse => {
        const key = `${verse.book}-${verse.chapter}-${verse.verse}`
        return texts[key] !== undefined && verse.spans.length === 0
      }).length
      if (missingSpansCount) {
        warnAboutRecoverableResourceIntegrity('strong-occurrences-incomplete', {
          versionId,
          book: request.book,
          reference: String(request.reference),
          missingTextCount,
          missingSpansCount,
        })
      }
      return {
        verses: scopedVerses.flatMap(verse => {
          const key = `${verse.book}-${verse.chapter}-${verse.verse}`
          const text = texts[key]
          return text == null
            ? []
            : [
                {
                  Livre: verse.book,
                  Chapitre: verse.chapter,
                  Verset: verse.verse,
                  Texte: text,
                  StrongSpans: verse.spans.map(toStrongBibleSpan),
                },
              ]
        }),
        ...(response.identity
          ? { identity: response.identity as ResolvedStrongBibleIdentity }
          : {}),
        ...(response.nextCursor === undefined ? {} : { nextCursor: response.nextCursor }),
      }
    },
    async loadLemmaStats(versionId, request) {
      const response = await get(
        `/v1/strong-bibles/${encodeURIComponent(versionId)}/books/${request.book}/identities/${encodeURIComponent(String(request.reference))}/lemmas`,
        StrongBibleLemmaStatsDto
      )
      assertPublicationIdentity(response.resource, versionId)
      assertConcordanceIdentity(response.identity, request)
      return {
        lemmas: response.lemmas.map(lemma => ({ ...lemma })),
        ...(response.identity
          ? { identity: response.identity as ResolvedStrongBibleIdentity }
          : {}),
      }
    },
  }
}

export const createHybridStrongBibleResourceAdapter = ({
  offline,
  online,
  remotelyReadableVersions,
  isOnline,
}: {
  offline: StrongBibleResourceAdapter
  online: StrongBibleResourceAdapter
  remotelyReadableVersions: ReadonlySet<string>
  isOnline: () => Promise<boolean>
}): StrongBibleResourceAdapter => {
  const isInvalidLocalAvailability = (availability: StrongBibleSidecarAvailability) =>
    availability.status === 'corrupt' ||
    availability.status === 'incompatible' ||
    availability.status === 'base-incompatible'
  const invalidOfflineCopy = () =>
    new ResourceAccessError('INVALID_OFFLINE_COPY', [
      'acquire-offline-copy',
      'manage-offline-copies',
    ])
  const select = async <Result>(
    versionId: StrongBibleVersionId,
    localOperation: () => Promise<Result>,
    remoteOperation: () => Promise<Result>
  ): Promise<Result> => {
    const local = await offline.getAvailability(versionId)
    if (local.status === 'available') {
      try {
        return await localOperation()
      } catch (error) {
        const mapped = mapLocalResourceError(error)
        if (!remotelyReadableVersions.has(versionId) || !(await isOnline())) throw mapped
      }
    }
    if (local.status === 'incompatible' || local.status === 'base-incompatible') {
      throw invalidOfflineCopy()
    }
    if (!remotelyReadableVersions.has(versionId)) {
      if (isInvalidLocalAvailability(local)) throw invalidOfflineCopy()
      throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
    }
    if (!(await isOnline())) {
      if (isInvalidLocalAvailability(local)) throw invalidOfflineCopy()
      throw new ResourceAccessError('NETWORK_OFFLINE')
    }
    try {
      return await remoteOperation()
    } catch (error) {
      if (isInvalidLocalAvailability(local)) throw invalidOfflineCopy()
      throw error
    }
  }

  return {
    async getAvailability(versionId) {
      const local = await offline.getAvailability(versionId)
      if (local.status === 'available') return local
      if (local.status === 'incompatible' || local.status === 'base-incompatible') return local
      if (
        !isStrongCapableBibleVersion(versionId) ||
        !remotelyReadableVersions.has(versionId) ||
        !(await isOnline())
      ) {
        return local
      }
      return online.getAvailability(versionId)
    },
    loadChapterSpans: (versionId, request) =>
      select(
        versionId,
        () => offline.loadChapterSpans(versionId, request),
        () => online.loadChapterSpans(versionId, request)
      ),
    loadVerse: (versionId, request) =>
      select(
        versionId,
        () => offline.loadVerse(versionId, request),
        () => online.loadVerse(versionId, request)
      ),
    loadCountsByBook: (versionId, request) =>
      select(
        versionId,
        () => offline.loadCountsByBook(versionId, request),
        () => online.loadCountsByBook(versionId, request)
      ),
    loadFoundVersesByBook: (versionId, request) =>
      select(
        versionId,
        () => offline.loadFoundVersesByBook(versionId, request),
        () => online.loadFoundVersesByBook(versionId, request)
      ),
    loadLemmaStats: (versionId, request) =>
      select(
        versionId,
        () => offline.loadLemmaStats(versionId, request),
        () => online.loadLemmaStats(versionId, request)
      ),
  }
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
    const candidates = request.preferredVersionId
      ? [request.preferredVersionId]
      : [...new Set([currentVersionId, request.defaultVersionId, ...fallbackVersionIds])].filter(
          (candidate): candidate is string => Boolean(candidate)
        )
    const attempts: StrongBibleAttempt[] = []

    for (const candidate of candidates) {
      if (!isStrongCapableBibleVersion(candidate)) {
        attempts.push({ versionId: candidate, status: 'unsupported' })
        continue
      }
      let availability: StrongBibleSidecarAvailability
      try {
        availability = await adapter.getAvailability(candidate)
      } catch (error) {
        throw error
      }
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
      if (
        (request.expectedTextRevision &&
          spansByVerse.textRevision !== request.expectedTextRevision) ||
        (request.expectedTextSha256 && spansByVerse.textSha256 !== request.expectedTextSha256)
      ) {
        throw new ResourceAccessError('INTEGRITY_FAILURE')
      }
      return {
        status: 'available',
        provenance: resolution.provenance,
        codes: [
          ...new Set(
            Object.values(spansByVerse.spansByVerse).flatMap(spans =>
              spans.flatMap(span => span.identities.map(identity => identity.code))
            )
          ),
        ],
      }
    },

    async loadChapterSpans(request) {
      const resolution = await resolve(request)
      if (resolution.status !== 'available') return resolution
      const loaded = await adapter.loadChapterSpans(resolution.provenance.versionId, {
        book: request.book,
        chapter: request.chapter,
      })
      return {
        status: 'available',
        provenance: resolution.provenance,
        spansByVerse: loaded.spansByVerse,
        ...(loaded.textRevision ? { textRevision: loaded.textRevision } : {}),
        ...(loaded.textSha256 ? { textSha256: loaded.textSha256 } : {}),
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
        ...(loaded.nextCursor == null ? {} : { nextPageToken: loaded.nextCursor }),
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
