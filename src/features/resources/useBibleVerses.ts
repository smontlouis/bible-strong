import { useQuery } from '@tanstack/react-query'

import type { Verse } from '~common/types'
import type { BibleRecoveryAction } from '~helpers/bibleErrors'
import {
  type BibleVerseResolutionStatus,
  getBibleVerseResolutionRequestKey,
  resolveBibleVerses,
} from '~helpers/bibleVerseResolver'
import { localQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { useResourceAccess } from './resourceAccess'

export const verseStringToObject = (arrayString: string[]): Omit<Verse, 'Texte'>[] =>
  arrayString.map(string => {
    const [Livre, Chapitre, Verset] = string.split('-')
    return { Livre, Chapitre, Verset }
  })

type ResolvedBibleVerses = {
  verses: Verse[]
  version?: string
  status: BibleVerseResolutionStatus
  missingVerseKeys: string[]
  isLoading: boolean
  error: Error | null
  recoveries?: BibleRecoveryAction[]
  retry: () => void
}

export const useResolvedBibleVerses = (
  verseIds: Omit<Verse, 'Texte'>[],
  preferredVersion?: string
): ResolvedBibleVerses => {
  const verseKeys = verseIds.map(({ Livre, Chapitre, Verset }) => `${Livre}-${Chapitre}-${Verset}`)
  const defaultVersion = useDefaultBibleVersion()
  const resources = useResourceAccess()
  const version = preferredVersion || defaultVersion
  const requestKey = getBibleVerseResolutionRequestKey({
    verseKeys,
    preferredVersion,
    defaultVersion,
  })

  const query = useQuery({
    queryKey: [...resourceQueryKeys.bibleVerseSelection(version, verseKeys), requestKey],
    queryFn: async () => {
      if (!verseKeys.length) {
        return {
          verses: [],
          version,
          status: 'resolved' as const,
          missingVerseKeys: [],
        }
      }
      const resolution = await resolveBibleVerses(
        { verseKeys, preferredVersion, defaultVersion },
        {
          loadVerseTexts: (selectedVersion, selectedVerseKeys) =>
            resources.bibleContent.loadVerseTexts({
              version: selectedVersion,
              verseKeys: selectedVerseKeys,
            }),
          getAvailability: resources.bibleContent.getAvailability,
        }
      )
      return {
        verses: verseKeys
          .filter(key => resolution.texts[key])
          .map(key => {
            const [Livre, Chapitre, Verset] = key.split('-')
            return { Livre, Chapitre, Verset, Texte: resolution.texts[key] }
          }) as Verse[],
        version: resolution.version,
        status: resolution.status,
        missingVerseKeys: resolution.missingVerseKeys,
        recoveries: resolution.recoveries,
      }
    },
    staleTime: Infinity,
    ...localQueryOptions,
  })

  return {
    verses: query.data?.verses ?? [],
    version: query.data?.version,
    status: query.data?.status ?? 'reference-only',
    missingVerseKeys: query.data?.missingVerseKeys ?? verseKeys,
    isLoading: query.isPending,
    error: query.error,
    recoveries: query.data?.recoveries,
    retry: () => void query.refetch(),
  }
}

const useBibleVerses = (verseIds: Omit<Verse, 'Texte'>[], preferredVersion?: string) =>
  useResolvedBibleVerses(verseIds, preferredVersion).verses

export default useBibleVerses
