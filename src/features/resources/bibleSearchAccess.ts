import {
  getInstalledVersions,
  searchVerses,
  searchVersesCount,
  type SearchOptions,
  type SearchResult,
} from '~helpers/biblesDb'
import { Schema } from 'effect'
import { BibleSearchResponseDto } from './bibleChapterContract'
import { ResourceAccessError } from './resourceAccessError'

export type { SearchOptions, SearchResult, SearchSortOrder } from '~helpers/biblesDb'

export type BibleSearchAccess = {
  getInstalledVersions: () => Promise<string[]>
  searchVerses: (query: string, options?: SearchOptions) => Promise<SearchResult[]>
  searchVersesCount: (query: string, options?: SearchOptions) => Promise<number>
}

export const localBibleSearchAccess: BibleSearchAccess = {
  getInstalledVersions,
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

const requestError = (status: number, code: unknown) => {
  if (status === 404 && code === 'BIBLE_UNSUPPORTED') {
    return new ResourceAccessError('RESOURCE_UNSUPPORTED', ['acquire-offline-copy'])
  }
  if (status === 503) return new ResourceAccessError('TEMPORARY_UNAVAILABLE')
  return new ResourceAccessError('TEMPORARY_UNAVAILABLE')
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
        throw requestError(response.status, code)
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
    const results = await Promise.allSettled(
      requestedVersions.map(version => searchVersion(version, query, options))
    )
    const fulfilled = results.flatMap(result =>
      result.status === 'fulfilled' ? [result.value] : []
    )
    if (fulfilled.length === 0) {
      const failure = results.find(result => result.status === 'rejected')
      throw failure?.reason ?? new ResourceAccessError('TEMPORARY_UNAVAILABLE')
    }
    return {
      results: fulfilled.flatMap(value => Array.from(value.results)),
      count: fulfilled.reduce((total, value) => total + value.count, 0),
    }
  }

  return {
    getInstalledVersions: async () => [...versions],
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
  const run = async <T>(
    operation: (access: BibleSearchAccess) => Promise<T>,
    fallback: () => Promise<T>
  ) => {
    if (await isOnline()) {
      try {
        return await operation(online)
      } catch (error) {
        if (!(error instanceof ResourceAccessError) || error.code === 'INTEGRITY_FAILURE') {
          throw error
        }
      }
    }
    return fallback()
  }
  return {
    getInstalledVersions: async () => {
      const local = await offline.getInstalledVersions()
      return Array.from(new Set([...local, ...remotelyReadableVersions]))
    },
    searchVerses: (query, options) =>
      run(
        access => access.searchVerses(query, options),
        () => offline.searchVerses(query, options)
      ),
    searchVersesCount: (query, options) =>
      run(
        access => access.searchVersesCount(query, options),
        () => offline.searchVersesCount(query, options)
      ),
  }
}
