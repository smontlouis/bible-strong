import {
  getInstalledVersions,
  searchVerses,
  searchVersesCount,
  type SearchOptions,
  type SearchResult,
} from '~helpers/biblesDb'
import { Schema } from 'effect'
import { BibleSearchResponseDto } from './bibleChapterContract'
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
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const params = new URLSearchParams({ q: query })
      if (options.book !== undefined) params.set('book', String(options.book))
      if (options.section) params.set('section', options.section)
      if (options.sortOrder) params.set('sortOrder', options.sortOrder)
      if (options.limit !== undefined) params.set('limit', String(options.limit))
      if (options.offset !== undefined) params.set('offset', String(options.offset))
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/bibles/${encodeURIComponent(version)}/search?${params}`,
        { headers: { accept: 'application/json' }, signal: controller.signal }
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
      if (error instanceof ResourceAccessError) throw error
      throw new ResourceAccessError(
        (await isOnline()) ? 'TEMPORARY_UNAVAILABLE' : 'NETWORK_OFFLINE'
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  const run = async (query: string, options: SearchOptions = {}) => {
    const requestedVersions = options.version ? [options.version] : [...versions]
    if (requestedVersions.length === 0) throw new ResourceAccessError('RESOURCE_UNSUPPORTED')
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
