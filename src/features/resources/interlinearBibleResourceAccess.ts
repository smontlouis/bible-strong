import { Schema } from 'effect'

import type { ResourceLanguage } from '~helpers/databaseTypes'
import {
  getInterlinearSidecarAvailability,
  loadInterlinearChapterTokens,
  type InterlinearChapterTokens,
  type InterlinearSidecarAvailability,
  type InterlinearToken,
} from '~helpers/interlinearBibleSidecar'
import type { BibleChapterAdapter } from './bibleChapterSource'
import { InterlinearBibleChapterDto, InterlinearBibleCoverageDto } from './interlinearBibleContract'
import {
  mapLocalResourceError,
  ResourceAccessError,
  resourceAccessErrorFromBibleChapterUnavailable,
  resourceAccessErrorFromHttpResponse,
} from './resourceAccessError'
import { warnAboutRecoverableResourceIntegrity } from './recoverableIntegrity'

export type InterlinearChapterTokensPayload = {
  tokensByVerse: InterlinearChapterTokens
  textRevision?: string
  textSha256?: string
}

export interface InterlinearBibleResourceAdapter {
  getAvailability: (locale: ResourceLanguage) => Promise<InterlinearSidecarAvailability>
  loadChapterTokens: (
    locale: ResourceLanguage,
    request: { book: number; chapter: number }
  ) => Promise<InterlinearChapterTokensPayload>
}

export type InterlinearBibleResourceAccess = InterlinearBibleResourceAdapter

export const localInterlinearBibleResourceAdapter: InterlinearBibleResourceAdapter = {
  getAvailability: getInterlinearSidecarAvailability,
  async loadChapterTokens(locale, request) {
    const [tokensByVerse, availability] = await Promise.all([
      loadInterlinearChapterTokens('BHG', locale, request.book, request.chapter),
      getInterlinearSidecarAvailability(locale),
    ])
    return {
      tokensByVerse,
      ...(availability.status === 'available' ? { textRevision: availability.textRevision } : {}),
    }
  },
}

type HttpInterlinearBibleResourceAdapterOptions = {
  baseUrl: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  bibleChapterAdapter: BibleChapterAdapter
  timeoutMs?: number
}

const problemCode = (payload: unknown) =>
  payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined

const mapHttpFailure = (response: Response, payload: unknown): ResourceAccessError => {
  const code = problemCode(payload)
  if (response.status === 404 && code === 'INTERLINEAR_CHAPTER_NOT_FOUND') {
    return resourceAccessErrorFromHttpResponse('NOT_FOUND', response, code)
  }
  if (response.status === 404 && code === 'INTERLINEAR_UNSUPPORTED') {
    return resourceAccessErrorFromHttpResponse('RESOURCE_UNSUPPORTED', response, code)
  }
  return resourceAccessErrorFromHttpResponse('TEMPORARY_UNAVAILABLE', response, code)
}

const toInterlinearToken = (
  token: InterlinearBibleChapterDto['verses'][number]['tokens'][number]
): InterlinearToken => ({
  id: token.id,
  ordinal: token.ordinal,
  startOffset: token.startOffset,
  length: token.length,
  segments: token.segments.map(segment => ({
    ordinal: segment.ordinal,
    startOffset: segment.startOffset,
    length: segment.length,
    transliteration: segment.transliteration,
    lemma: segment.lemma,
    morphology: segment.morphology,
    gloss: segment.gloss,
    identities: segment.identities.map(identity => ({ ...identity })),
  })),
})

export const createHttpInterlinearBibleResourceAdapter = ({
  baseUrl,
  fetcher = fetch,
  isOnline,
  bibleChapterAdapter,
  timeoutMs = 10_000,
}: HttpInterlinearBibleResourceAdapterOptions): InterlinearBibleResourceAdapter => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const get = async <A>(path: string, schema: Schema.Schema<A>): Promise<A> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(`${normalizedBaseUrl}${path}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })
      const payload: unknown = await response.json().catch(() => undefined)
      if (!response.ok) throw mapHttpFailure(response, payload)
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

  const resourcePath = (locale: ResourceLanguage) =>
    `/v1/interlinear-bibles/BHG/languages/${encodeURIComponent(locale)}`

  return {
    async getAvailability(locale) {
      try {
        const coverage = await get(`${resourcePath(locale)}/coverage`, InterlinearBibleCoverageDto)
        if (coverage.resource.language !== locale) {
          throw new ResourceAccessError('INTEGRITY_FAILURE')
        }
        const bibleCoverage = await bibleChapterAdapter.loadCoverage('BHG')
        if (bibleCoverage.status !== 'available') {
          throw resourceAccessErrorFromBibleChapterUnavailable(
            bibleCoverage.reason,
            undefined,
            bibleCoverage.diagnostics
          )
        }
        if (
          bibleCoverage.textRevision !== coverage.resource.textRevision ||
          bibleCoverage.textSha256 !== coverage.resource.textSha256
        ) {
          warnAboutRecoverableResourceIntegrity('interlinear-bible-coverage-revision-mismatch', {
            locale,
            bibleTextRevision: bibleCoverage.textRevision,
            interlinearTextRevision: coverage.resource.textRevision,
          })
        }
        return {
          status: 'available',
          locale,
          textRevision: coverage.resource.textRevision,
        }
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'RESOURCE_UNSUPPORTED') {
          return { status: 'missing' }
        }
        throw error
      }
    },
    async loadChapterTokens(locale, request) {
      const [chapter, bibleChapter] = await Promise.all([
        get(
          `${resourcePath(locale)}/books/${request.book}/chapters/${request.chapter}`,
          InterlinearBibleChapterDto
        ),
        bibleChapterAdapter.loadChapter('BHG', request.book, request.chapter),
      ])
      if (
        chapter.resource.language !== locale ||
        chapter.book !== request.book ||
        chapter.chapter !== request.chapter
      ) {
        throw new ResourceAccessError('INTEGRITY_FAILURE')
      }
      if (bibleChapter.status !== 'available') {
        throw resourceAccessErrorFromBibleChapterUnavailable(
          bibleChapter.reason,
          bibleChapter.recoveries,
          bibleChapter.diagnostics
        )
      }
      if (
        bibleChapter.textRevision !== chapter.resource.textRevision ||
        bibleChapter.textSha256 !== chapter.resource.textSha256 ||
        bibleChapter.verses.some(
          verse => verse.TextRevision && verse.TextRevision !== chapter.resource.textRevision
        )
      ) {
        warnAboutRecoverableResourceIntegrity('interlinear-bible-text-revision-mismatch', {
          locale,
          book: request.book,
          chapter: request.chapter,
          bibleTextRevision: bibleChapter.textRevision,
          interlinearTextRevision: chapter.resource.textRevision,
        })
      }
      return {
        tokensByVerse: Object.fromEntries(
          chapter.verses.map(verse => [verse.number, verse.tokens.map(toInterlinearToken)])
        ),
        textRevision: chapter.resource.textRevision,
        textSha256: chapter.resource.textSha256,
      }
    },
  }
}

export const createHybridInterlinearBibleResourceAdapter = ({
  offline,
  online,
  remotelyReadableLocales,
  isOnline,
}: {
  offline: InterlinearBibleResourceAdapter
  online: InterlinearBibleResourceAdapter
  remotelyReadableLocales: ReadonlySet<ResourceLanguage>
  isOnline: () => Promise<boolean>
}): InterlinearBibleResourceAdapter => {
  const isInvalid = (availability: InterlinearSidecarAvailability) =>
    availability.status === 'corrupt' || availability.status === 'incompatible'
  const invalidOfflineCopy = () =>
    new ResourceAccessError('INVALID_OFFLINE_COPY', [
      'acquire-offline-copy',
      'manage-offline-copies',
    ])

  return {
    async getAvailability(locale) {
      const local = await offline.getAvailability(locale)
      if (local.status === 'available' || local.status === 'base-incompatible') return local
      if (!remotelyReadableLocales.has(locale) || !(await isOnline())) return local
      return online.getAvailability(locale)
    },
    async loadChapterTokens(locale, request) {
      const local = await offline.getAvailability(locale)
      if (local.status === 'available') {
        try {
          return await offline.loadChapterTokens(locale, request)
        } catch (error) {
          const mapped = mapLocalResourceError(error)
          if (!remotelyReadableLocales.has(locale) || !(await isOnline())) throw mapped
        }
      }
      if (local.status === 'base-incompatible') {
        throw invalidOfflineCopy()
      }
      if (!remotelyReadableLocales.has(locale)) {
        if (isInvalid(local)) throw invalidOfflineCopy()
        throw new ResourceAccessError('OFFLINE_COPY_REQUIRED', ['acquire-offline-copy'])
      }
      if (!(await isOnline())) {
        if (isInvalid(local)) throw invalidOfflineCopy()
        throw new ResourceAccessError('NETWORK_OFFLINE')
      }
      try {
        return await online.loadChapterTokens(locale, request)
      } catch (error) {
        if (isInvalid(local)) throw invalidOfflineCopy()
        throw error
      }
    },
  }
}

export const localInterlinearBibleResourceAccess: InterlinearBibleResourceAccess =
  localInterlinearBibleResourceAdapter
