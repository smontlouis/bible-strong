import * as FileSystem from 'expo-file-system/legacy'
import { Schema } from 'effect'

import type { TimelineEventDetail } from '~features/timeline/types'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getDbPath } from '~helpers/databases'
import {
  getLocalResourceAvailability,
  type LocalResourceAvailability,
  type LocalResourceRef,
} from './resourceAvailability'
import { ResourceAccessError, type ResourceRecoveryAction } from './resourceAccessError'
import { TimelineEventResponseDto, TimelineEventsResponseDto } from './timelineContract'

export type TimelineEventSummary = Pick<
  TimelineEventDetail,
  'id' | 'slug' | 'title' | 'description' | 'period' | 'dates' | 'images'
>

export type TimelineDetailsResult =
  | { status: 'available'; details: TimelineEventDetail[] }
  | {
      status: 'unavailable'
      reason:
        | 'offline-copy-required'
        | 'invalid-offline-copy'
        | 'network-offline'
        | 'temporary-unavailable'
      recoveries: ResourceRecoveryAction[]
    }

export type TimelineIndexResult =
  | { status: 'available'; details: TimelineEventSummary[] }
  | Exclude<TimelineDetailsResult, { status: 'available' }>

export type TimelineEventResult =
  | { status: 'available'; detail: TimelineEventDetail }
  | Exclude<TimelineDetailsResult, { status: 'available' }>

export type TimelineAccess = {
  getAvailability?: (language: ResourceLanguage) => Promise<
    | {
        status: 'available'
      }
    | (TimelineDetailsResult & { status: 'unavailable' })
  >
  loadIndex: (language: ResourceLanguage) => Promise<TimelineIndexResult>
  searchIndex: (
    query: string,
    language: ResourceLanguage,
    limit?: number
  ) => Promise<TimelineIndexResult>
  loadEvent: (language: ResourceLanguage, slug: string) => Promise<TimelineEventResult>
}

type TimelineAccessDependencies = {
  getAvailability: (identity: LocalResourceRef) => Promise<LocalResourceAvailability>
  getPath: (databaseId: 'TIMELINE', language: ResourceLanguage) => string
  readText: (path: string) => Promise<string>
  getCacheKey?: (path: string) => Promise<string>
}

const defaultDependencies: TimelineAccessDependencies = {
  getAvailability: getLocalResourceAvailability,
  getPath: getDbPath,
  readText: FileSystem.readAsStringAsync,
  getCacheKey: async path => {
    const info = await FileSystem.getInfoAsync(path)
    return info.exists
      ? `${path}:${info.modificationTime ?? 0}:${'size' in info ? info.size : 0}`
      : `${path}:missing`
  },
}

const isTimelineEventDetailList = (value: unknown): value is TimelineEventDetail[] =>
  Array.isArray(value) &&
  value.every(item => item !== null && typeof item === 'object' && !Array.isArray(item))

export const createLocalTimelineAccess = (
  dependencies: TimelineAccessDependencies = defaultDependencies
): TimelineAccess => {
  const cache = new Map<
    ResourceLanguage,
    { key: string; pending: Promise<TimelineDetailsResult> }
  >()
  const loadDetails = async (language: ResourceLanguage) => {
    const path = dependencies.getPath('TIMELINE', language)
    const key = dependencies.getCacheKey ? await dependencies.getCacheKey(path) : path
    const cached = cache.get(language)
    if (cached?.key === key) return cached.pending
    const pending = loadTimelineDetails(language, path)
    cache.set(language, { key, pending })
    void pending.then(
      result => {
        if (result.status === 'unavailable' && cache.get(language)?.pending === pending) {
          cache.delete(language)
        }
      },
      () => {
        if (cache.get(language)?.pending === pending) {
          cache.delete(language)
        }
      }
    )
    return pending
  }
  const loadTimelineDetails = async (
    language: ResourceLanguage,
    path: string
  ): Promise<TimelineDetailsResult> => {
    const identity = { kind: 'database', databaseId: 'TIMELINE', language } as const
    const availability = await dependencies.getAvailability(identity)
    if (availability.status !== 'available') {
      return {
        status: 'unavailable',
        reason:
          availability.status === 'missing' ? 'offline-copy-required' : 'invalid-offline-copy',
        recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
      }
    }

    let serialized: string
    try {
      serialized = await dependencies.readText(path)
    } catch {
      return { status: 'unavailable', reason: 'temporary-unavailable', recoveries: [] }
    }

    try {
      const value: unknown = JSON.parse(serialized)
      if (!isTimelineEventDetailList(value)) throw new Error('TIMELINE_CONTENT_INVALID')
      return { status: 'available', details: value }
    } catch {
      return {
        status: 'unavailable',
        reason: 'invalid-offline-copy',
        recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
      }
    }
  }

  return {
    getAvailability: async language => {
      const availability = await dependencies.getAvailability({
        kind: 'database',
        databaseId: 'TIMELINE',
        language,
      })
      return availability.status === 'available'
        ? { status: 'available' }
        : {
            status: 'unavailable',
            reason:
              availability.status === 'missing' ? 'offline-copy-required' : 'invalid-offline-copy',
            recoveries: ['acquire-offline-copy', 'manage-offline-copies'],
          }
    },
    loadIndex: async language => {
      const result = await loadDetails(language)
      if (result.status === 'unavailable') return result
      return {
        status: 'available',
        details: result.details.map(({ id, slug, title, description, period, dates, images }) => ({
          id,
          slug,
          title,
          description,
          period,
          dates,
          images,
        })),
      }
    },
    searchIndex: async (query, language, limit = 50) => {
      const result = await loadDetails(language)
      if (result.status === 'unavailable') return result
      const normalized = query.trim().toLocaleLowerCase()
      return {
        status: 'available',
        details: result.details
          .filter(event =>
            `${event.title} ${event.description} ${event.article}`
              .toLocaleLowerCase()
              .includes(normalized)
          )
          .slice(0, limit)
          .map(({ id, slug, title, description, period, dates, images }) => ({
            id,
            slug,
            title,
            description,
            period,
            dates,
            images,
          })),
      }
    },
    loadEvent: async (language, slug) => {
      const result = await loadDetails(language)
      if (result.status === 'unavailable') return result
      const detail = result.details.find(event => event.slug === slug)
      return detail
        ? { status: 'available', detail }
        : { status: 'unavailable', reason: 'invalid-offline-copy', recoveries: [] }
    },
  }
}

type HttpTimelineAccessOptions = {
  baseUrl: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  timeoutMs?: number
}

const timelineResourceError = (status: number, code: unknown) => {
  if (status === 404 && code === 'TIMELINE_EVENT_NOT_FOUND') {
    return new ResourceAccessError('NOT_FOUND')
  }
  if (status === 503 || code === 'TIMELINE_PUBLICATION_INACTIVE') {
    return new ResourceAccessError('TEMPORARY_UNAVAILABLE')
  }
  return new ResourceAccessError('TEMPORARY_UNAVAILABLE')
}

export const createHttpTimelineAccess = ({
  baseUrl,
  fetcher = fetch,
  isOnline,
  timeoutMs = 10_000,
}: HttpTimelineAccessOptions): TimelineAccess => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const request = async (path: string): Promise<unknown> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(`${normalizedBaseUrl}${path}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })
      const payload: unknown = await response.json().catch(() => undefined)
      if (!response.ok) {
        const code =
          payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
        throw timelineResourceError(response.status, code)
      }
      return payload
    } catch (error) {
      if (error instanceof ResourceAccessError) throw error
      throw new ResourceAccessError(
        (await isOnline()) ? 'TEMPORARY_UNAVAILABLE' : 'NETWORK_OFFLINE'
      )
    } finally {
      clearTimeout(timeout)
    }
  }
  const loadIndex = async (language: ResourceLanguage): Promise<TimelineIndexResult> => {
    const payload = await request(`/v1/timelines/${language}/events`)
    const decoded = Schema.decodeUnknownSync(TimelineEventsResponseDto)(payload)
    if (decoded.resource.language !== language) throw new ResourceAccessError('INTEGRITY_FAILURE')
    return {
      status: 'available',
      details: Array.from(decoded.events).map(event => ({
        ...event,
        images: Array.from(event.images).map(image => ({ ...image })),
      })),
    }
  }
  const searchIndex = async (
    query: string,
    language: ResourceLanguage,
    limit = 50
  ): Promise<TimelineIndexResult> => {
    const params = new URLSearchParams({ search: query, limit: String(limit) })
    const payload = await request(`/v1/timelines/${language}/events?${params}`)
    const decoded = Schema.decodeUnknownSync(TimelineEventsResponseDto)(payload)
    if (decoded.resource.language !== language) throw new ResourceAccessError('INTEGRITY_FAILURE')
    return {
      status: 'available',
      details: Array.from(decoded.events).map(event => ({
        ...event,
        images: Array.from(event.images).map(image => ({ ...image })),
      })),
    }
  }
  const loadEvent = async (
    language: ResourceLanguage,
    slug: string
  ): Promise<TimelineEventResult> => {
    const payload = await request(`/v1/timelines/${language}/events/${encodeURIComponent(slug)}`)
    const decoded = Schema.decodeUnknownSync(TimelineEventResponseDto)(payload)
    if (decoded.resource.language !== language || decoded.event.slug !== slug) {
      throw new ResourceAccessError('INTEGRITY_FAILURE')
    }
    return {
      status: 'available',
      detail: {
        ...decoded.event,
        related: Array.from(decoded.event.related).map(related => ({ ...related })),
        images: Array.from(decoded.event.images).map(image => ({ ...image })),
        videos: Array.from(decoded.event.videos).map(video => ({ ...video })),
        scriptures: Array.from(decoded.event.scriptures),
      },
    }
  }
  return {
    getAvailability: async language => {
      try {
        await loadIndex(language)
        return { status: 'available' }
      } catch {
        return {
          status: 'unavailable',
          reason: 'temporary-unavailable',
          recoveries: [],
        }
      }
    },
    loadIndex,
    searchIndex,
    loadEvent,
  }
}

export const createHybridTimelineAccess = ({
  offline,
  online,
  remotelyReadableLanguages,
  isOnline,
}: {
  offline: TimelineAccess
  online: TimelineAccess
  remotelyReadableLanguages: ReadonlySet<ResourceLanguage>
  isOnline: () => Promise<boolean>
}): TimelineAccess => {
  const offlineResult = <T extends TimelineIndexResult | TimelineEventResult>(local: T): T =>
    local.status === 'unavailable' && local.reason === 'offline-copy-required'
      ? ({
          status: 'unavailable',
          reason: 'network-offline',
          recoveries: ['retry'],
        } as T)
      : local

  return {
    getAvailability: async language => {
      const local = await offline.getAvailability?.(language)
      if (local?.status === 'available' || remotelyReadableLanguages.has(language)) {
        return { status: 'available' }
      }
      return (
        local ?? {
          status: 'unavailable' as const,
          reason: 'offline-copy-required' as const,
          recoveries: ['acquire-offline-copy'] as const,
        }
      )
    },
    loadIndex: async language => {
      const local = await offline.loadIndex(language)
      if (local.status === 'available') return local
      if (!remotelyReadableLanguages.has(language)) return local
      if (!(await isOnline())) return offlineResult(local)
      try {
        return await online.loadIndex(language)
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NETWORK_OFFLINE') return local
        throw error
      }
    },
    searchIndex: async (query, language, limit) => {
      const local = await offline.searchIndex(query, language, limit)
      if (local.status === 'available') return local
      if (!remotelyReadableLanguages.has(language)) return local
      if (!(await isOnline())) return offlineResult(local)
      try {
        return await online.searchIndex(query, language, limit)
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NETWORK_OFFLINE') return local
        throw error
      }
    },
    loadEvent: async (language, slug) => {
      const local = await offline.loadEvent(language, slug)
      if (local.status === 'available') return local
      if (!remotelyReadableLanguages.has(language)) return local
      if (!(await isOnline())) return offlineResult(local)
      try {
        return await online.loadEvent(language, slug)
      } catch (error) {
        if (error instanceof ResourceAccessError && error.code === 'NETWORK_OFFLINE') return local
        throw error
      }
    },
  }
}

export const localTimelineAccess = createLocalTimelineAccess()
