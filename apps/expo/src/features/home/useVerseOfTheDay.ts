import { useQuery } from '@tanstack/react-query'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { useDefaultBibleVersion } from '../../state/useDefaultBibleVersion'
import {
  createVerseOfTheDayQueryOptions,
  type VerseOfTheDayData as ResolvedVerseOfTheDayData,
} from './verseOfTheDayQuery'

export type VerseOfTheDayData = ResolvedVerseOfTheDayData | { error: true } | false

/** Content only. Notification reconciliation is mounted once in the application runtime. */
export const useVerseOfTheDay = (addDay: number): VerseOfTheDayData => {
  const resources = useResourceAccess()
  const version = useDefaultBibleVersion()
  const query = useQuery(createVerseOfTheDayQueryOptions(resources, version, addDay))
  return query.isError ? { error: true } : (query.data ?? false)
}
