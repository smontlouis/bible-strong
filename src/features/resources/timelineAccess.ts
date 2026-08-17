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
import { ResourceAccessError } from './resourceAccessError'
import { TimelineEventsResponseDto } from './timelineContract'

export type TimelineDetailsResult =
  | { status: 'available'; details: TimelineEventDetail[] }
  | {
      status: 'unavailable'
      reason: 'offline-copy-required' | 'invalid-offline-copy' | 'temporary-unavailable'
      recoveries: ('acquire-offline-copy' | 'manage-offline-copies')[]
    }

export type TimelineAccess = {
  getAvailability?: (language: ResourceLanguage) => Promise<
    | {
        status: 'available'
      }
    | (TimelineDetailsResult & { status: 'unavailable' })
  >
  loadDetails: (language: ResourceLanguage) => Promise<TimelineDetailsResult>
}

type TimelineAccessDependencies = {
  getAvailability: (identity: LocalResourceRef) => Promise<LocalResourceAvailability>
  getPath: (databaseId: 'TIMELINE', language: ResourceLanguage) => string
  readText: (path: string) => Promise<string>
}

const defaultDependencies: TimelineAccessDependencies = {
  getAvailability: getLocalResourceAvailability,
  getPath: getDbPath,
  readText: FileSystem.readAsStringAsync,
}

const isTimelineEventDetailList = (value: unknown): value is TimelineEventDetail[] =>
  Array.isArray(value) &&
  value.every(item => item !== null && typeof item === 'object' && !Array.isArray(item))

export const createLocalTimelineAccess = (
  dependencies: TimelineAccessDependencies = defaultDependencies
): TimelineAccess => ({
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
  loadDetails: async language => {
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
      serialized = await dependencies.readText(dependencies.getPath('TIMELINE', language))
    } catch {
      return {
        status: 'unavailable',
        reason: 'temporary-unavailable',
        recoveries: [],
      }
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
  },
})

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
  const loadDetails = async (language: ResourceLanguage): Promise<TimelineDetailsResult> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(`${normalizedBaseUrl}/v1/timelines/${language}/events`, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })
      const payload: unknown = await response.json().catch(() => undefined)
      if (!response.ok) {
        const code =
          payload && typeof payload === 'object' && 'code' in payload ? payload.code : undefined
        throw timelineResourceError(response.status, code)
      }
      const decoded = Schema.decodeUnknownSync(TimelineEventsResponseDto)(payload)
      if (decoded.resource.language !== language) throw new ResourceAccessError('INTEGRITY_FAILURE')
      return {
        status: 'available',
        details: Array.from(decoded.events).map(event => ({
          ...event,
          related: Array.from(event.related).map(related => ({ ...related })),
          images: Array.from(event.images).map(image => ({ ...image })),
          videos: Array.from(event.videos).map(video => ({ ...video })),
          scriptures: Array.from(event.scriptures),
        })),
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
  return {
    getAvailability: async language => {
      try {
        await loadDetails(language)
        return { status: 'available' }
      } catch {
        return {
          status: 'unavailable',
          reason: 'temporary-unavailable',
          recoveries: [],
        }
      }
    },
    loadDetails,
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
}): TimelineAccess => ({
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
  loadDetails: async language => {
    const local = await offline.loadDetails(language)
    if (local.status === 'available') return local
    if (!remotelyReadableLanguages.has(language) || !(await isOnline())) return local
    try {
      return await online.loadDetails(language)
    } catch (error) {
      if (error instanceof ResourceAccessError && error.code === 'NETWORK_OFFLINE') return local
      throw error
    }
  },
})

export const localTimelineAccess = createLocalTimelineAccess()
