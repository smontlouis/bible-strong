import type { VersionCode } from '~state/tabs'
import { getDayOfTheYear } from './getDayOfTheYear'

export const VERSE_OF_THE_DAY_CACHE_TIME = 24 * 60 * 60 * 1000

export const VISIBLE_VERSE_OF_THE_DAY_OFFSETS = [-4, -3, -2, -1, 0]

export const getVerseOfTheDayPrefetchOffsets = (notificationsEnabled: boolean) =>
  notificationsEnabled ? [...VISIBLE_VERSE_OF_THE_DAY_OFFSETS, 1] : VISIBLE_VERSE_OF_THE_DAY_OFFSETS

export const getVerseOfTheDayNumber = (addDay: number) => {
  const requestedDay = getDayOfTheYear(addDay) + 1
  return requestedDay < 1 || requestedDay > 366 ? 1 : requestedDay
}

export const getVerseOfTheDayQueryKey = (version: VersionCode, addDay: number) =>
  ['verse-of-the-day', version, getVerseOfTheDayNumber(addDay)] as const
