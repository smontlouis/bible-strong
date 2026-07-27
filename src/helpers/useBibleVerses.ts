import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import { Verse } from '~common/types'
import { useDefaultBibleVersion } from '../state/useDefaultBibleVersion'
import { bibleDataRefreshSignalAtom } from '~state/app'
import {
  BibleVerseResolutionStatus,
  getBibleVerseResolutionRequestKey,
  resolveBibleVerses,
} from './bibleVerseResolver'
import { localQueryOptions } from './queryOptions'

export const verseStringToObject = (arrayString: string[]): Omit<Verse, 'Texte'>[] => {
  return arrayString.map(string => {
    const [Livre, Chapitre, Verset] = string.split('-')
    return { Livre, Chapitre, Verset }
  })
}

type ResolvedBibleVerses = {
  verses: Verse[]
  version?: string
  status: BibleVerseResolutionStatus
  missingVerseKeys: string[]
  isLoading: boolean
  error: Error | null
}

export const useResolvedBibleVerses = (
  verseIds: Omit<Verse, 'Texte'>[],
  preferredVersion?: string
): ResolvedBibleVerses => {
  const verseKeys = verseIds.map(({ Livre, Chapitre, Verset }) => `${Livre}-${Chapitre}-${Verset}`)
  const defaultVersion = useDefaultBibleVersion()
  const bibleDataRefreshSignal = useAtomValue(bibleDataRefreshSignalAtom)
  const requestKey = getBibleVerseResolutionRequestKey({
    verseKeys,
    preferredVersion,
    defaultVersion,
    dataRefreshSignal: bibleDataRefreshSignal,
  })

  const { data, error, isPending } = useQuery({
    queryKey: ['resolved-bible-verses', requestKey],
    queryFn: async () => {
      if (!verseKeys.length) {
        return {
          verses: [],
          version: preferredVersion || defaultVersion,
          status: 'resolved' as const,
          missingVerseKeys: [],
        }
      }
      const resolution = await resolveBibleVerses({
        verseKeys,
        preferredVersion,
        defaultVersion,
      })
      return {
        verses: verseKeys
          .filter(key => resolution.texts[key])
          .map(key => {
            const [Livre, Chapitre, Verset] = key.split('-')
            return {
              Livre,
              Chapitre,
              Verset,
              Texte: resolution.texts[key],
            }
          }) as Verse[],
        version: resolution.version,
        status: resolution.status,
        missingVerseKeys: resolution.missingVerseKeys,
      }
    },
    staleTime: Infinity,
    ...localQueryOptions,
  })

  return {
    verses: data?.verses ?? [],
    version: data?.version,
    status: data?.status ?? 'reference-only',
    missingVerseKeys: data?.missingVerseKeys ?? verseKeys,
    isLoading: isPending,
    error,
  }
}

const useBibleVerses = (verseIds: Omit<Verse, 'Texte'>[], preferredVersion?: string) => {
  return useResolvedBibleVerses(verseIds, preferredVersion).verses
}

export default useBibleVerses
