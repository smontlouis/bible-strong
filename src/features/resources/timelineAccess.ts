import * as FileSystem from 'expo-file-system/legacy'

import type { TimelineEventDetail } from '~features/timeline/types'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getDbPath } from '~helpers/databases'
import {
  getLocalResourceAvailability,
  type LocalResourceAvailability,
  type LocalResourceRef,
} from './resourceAvailability'

export type TimelineDetailsResult =
  | { status: 'available'; details: TimelineEventDetail[] }
  | {
      status: 'unavailable'
      reason: 'offline-copy-required' | 'invalid-offline-copy' | 'temporary-unavailable'
      recoveries: ('acquire-offline-copy' | 'manage-offline-copies')[]
    }

export type TimelineAccess = {
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

    try {
      const value: unknown = JSON.parse(
        await dependencies.readText(dependencies.getPath('TIMELINE', language))
      )
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

export const localTimelineAccess = createLocalTimelineAccess()
