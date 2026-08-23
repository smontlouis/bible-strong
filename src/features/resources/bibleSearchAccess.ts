import {
  getInstalledVersions,
  searchVerses,
  searchVersesCount,
  type SearchOptions,
  type SearchResult,
} from '~helpers/biblesDb'
import { Schema } from 'effect'
import { BibleMultiSearchResponseDto, BibleSearchResponseDto } from './bibleChapterContract'
import { ResourceAccessError, resourceAccessErrorFromHttpResponse } from './resourceAccessError'

export type { SearchOptions, SearchResult, SearchSortOrder } from '~helpers/biblesDb'

export type BibleSearchPage = {
  results: SearchResult[]
  count: number
}

export type BibleSearchAccess = {
  getInstalledVersions: () => Promise<string[]>
  searchPage: (query: string, options?: SearchOptions) => Promise<BibleSearchPage>
  searchVerses: (query: string, options?: SearchOptions) => Promise<SearchResult[]>
  searchVersesCount: (query: string, options?: SearchOptions) => Promise<number>
}

export const localBibleSearchAccess: BibleSearchAccess = {
  getInstalledVersions,
  searchPage: async (query, options) => {
    const [results, count] = await Promise.all([
      searchVerses(query, options),
      searchVersesCount(query, options),
    ])
    return { results, count }
  },
  searchVerses,
  searchVersesCount,
}

type HttpBibleSearchAccessOptions = {
  baseUrl: string
  versions: readonly string[]
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  timeoutMs?: number
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

const createRequestController = (signal: AbortSignal | undefined, timeoutMs: number) => {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const timeout = setTimeout(abort, timeoutMs)
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    },
  }
}

const requestError = (response: Response, code: unknown) => {
  if (response.status === 404 && code === 'BIBLE_UNSUPPORTED') {
    return resourceAccessErrorFromHttpResponse('RESOURCE_UNSUPPORTED', response, code, [
      'acquire-offline-copy',
    ])
  }
  return resourceAccessErrorFromHttpResponse('TEMPORARY_UNAVAILABLE', response, code)
}

export const createHttpBibleSearchAccess = ({
  baseUrl,
  versions,
  fetcher = fetch,
  isOnline,
  timeoutMs = 10_000,
}: HttpBibleSearchAccessOptions): BibleSearchAccess => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)

  const searchVersion = async (version: string, query: string, options: SearchOptions = {}) => {
    const request = createRequestController(options.signal, timeoutMs)
    try {
      const params = new URLSearchParams({ q: query })
      if (options.book !== undefined) params.set('book', String(options.book))
      if (options.section) params.set('section', options.section)
      if (options.canon) params.set('canon', options.canon)
      if (options.sortOrder) params.set('sortOrder', options.sortOrder)
      if (options.limit !== undefined) params.set('limit', String(options.limit))
      if (options.offset !== undefined) params.set('offset', String(options.offset))
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/bibles/${encodeURIComponent(version)}/search?${params}`,
        { headers: { accept: 'application/json' }, signal: request.signal }
      )
      const payload: unknown = await response.json().catch(() => undefined)
      if (!response.ok) {
        const code =
          payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
        throw requestError(response, code)
      }
      try {
        return Schema.decodeUnknownSync(BibleSearchResponseDto)(payload)
      } catch {
        throw new ResourceAccessError('INTEGRITY_FAILURE')
      }
    } catch (error) {
      if (options.signal?.aborted) throw error
      if (error instanceof ResourceAccessError) throw error
      throw new ResourceAccessError(
        (await isOnline()) ? 'TEMPORARY_UNAVAILABLE' : 'NETWORK_OFFLINE'
      )
    } finally {
      request.dispose()
    }
  }

  const run = async (query: string, options: SearchOptions = {}) => {
    const requestedVersions = options.version
      ? [options.version]
      : options.versionIds
        ? [...options.versionIds]
        : [...versions]
    if (requestedVersions.length === 0) return { results: [], count: 0 }
    if (!options.version) {
      const request = createRequestController(options.signal, timeoutMs)
      try {
        const params = new URLSearchParams({ q: query, versions: requestedVersions.join(',') })
        if (options.book !== undefined) params.set('book', String(options.book))
        if (options.section) params.set('section', options.section)
        if (options.canon) params.set('canon', options.canon)
        if (options.sortOrder) params.set('sortOrder', options.sortOrder)
        if (options.limit !== undefined) params.set('limit', String(options.limit))
        if (options.offset !== undefined) params.set('offset', String(options.offset))
        const response = await fetcher(`${normalizedBaseUrl}/v1/bibles/search?${params}`, {
          headers: { accept: 'application/json' },
          signal: request.signal,
        })
        const payload: unknown = await response.json().catch(() => undefined)
        if (!response.ok) {
          const code =
            payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
          throw requestError(response, code)
        }
        try {
          const decoded = Schema.decodeUnknownSync(BibleMultiSearchResponseDto)(payload)
          return { results: Array.from(decoded.results), count: decoded.count }
        } catch {
          throw new ResourceAccessError('INTEGRITY_FAILURE')
        }
      } catch (error) {
        if (options.signal?.aborted) throw error
        if (error instanceof ResourceAccessError) throw error
        throw new ResourceAccessError(
          (await isOnline()) ? 'TEMPORARY_UNAVAILABLE' : 'NETWORK_OFFLINE'
        )
      } finally {
        request.dispose()
      }
    }
    const results = await Promise.all(
      requestedVersions.map(version => searchVersion(version, query, options))
    )
    return {
      results: results.flatMap(value => Array.from(value.results)),
      count: results.reduce((total, value) => total + value.count, 0),
    }
  }

  return {
    getInstalledVersions: async () => [...versions],
    searchPage: run,
    searchVerses: async (query, options) => {
      const result = await run(query, options)
      return result.results
    },
    searchVersesCount: async (query, options) => {
      const result = await run(query, options)
      return result.count
    },
  }
}

export const createHybridBibleSearchAccess = ({
  offline,
  online,
  remotelyReadableVersions,
  isOnline,
}: {
  offline: BibleSearchAccess
  online: BibleSearchAccess
  remotelyReadableVersions: ReadonlySet<string>
  isOnline: () => Promise<boolean>
}): BibleSearchAccess => {
  const select = async (options?: SearchOptions): Promise<BibleSearchAccess> => {
    if (!(await isOnline())) return offline
    if (options?.version && !remotelyReadableVersions.has(options.version)) return offline
    return online
  }
  const run = async <T>(
    options: SearchOptions | undefined,
    operation: (access: BibleSearchAccess) => Promise<T>
  ) => operation(await select(options))
  return {
    getInstalledVersions: async () => {
      const local = await offline.getInstalledVersions()
      return Array.from(new Set([...local, ...remotelyReadableVersions]))
    },
    searchPage: (query, options) => run(options, access => access.searchPage(query, options)),
    searchVerses: (query, options) => run(options, access => access.searchVerses(query, options)),
    searchVersesCount: (query, options) =>
      run(options, access => access.searchVersesCount(query, options)),
  }
}
