import { useQueries } from '@tanstack/react-query'
import type { ResourceAccessRegistry } from '~features/resources/resourceAccess'
import type { RedWordsByVerse } from '~features/resources/bibleReadingResourceAccess'
import type { OfflineResourceRegistrySnapshot } from '~features/resources/resourceAvailability'
import { getOfflineResourceQuerySignal } from '~features/resources/useOfflineResourceRegistry'
import { localQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { useStableValue } from '~helpers/useStableList'
import type { ParallelVerse } from '../BibleDOM/BibleDOMWrapper'
import { loadBibleReadingRedWords, type BibleReadingChapterRequest } from '../bibleReadingChapter'

// Canonical chapters carry their own words of Jesus: only legacy texts need the side file.
const getLegacyParallelVersions = (parallelVerses: ParallelVerse[]) =>
  parallelVerses
    .filter(
      parallel =>
        !parallel.error &&
        parallel.verses.length > 0 &&
        !parallel.verses.some(verse => verse.TextRevision)
    )
    .map(parallel => parallel.id)

/** The words of Jesus of every parallel version, loaded as the main version's are. */
export const useParallelRedWords = ({
  parallelVerses,
  request,
  enabled,
  resources,
  resourceRegistry,
}: {
  parallelVerses: ParallelVerse[]
  request: BibleReadingChapterRequest
  enabled: boolean
  resources: ResourceAccessRegistry
  resourceRegistry: OfflineResourceRegistrySnapshot
}): Record<string, RedWordsByVerse | null> => {
  const versions = getLegacyParallelVersions(parallelVerses)
  const availabilityQueries = useQueries({
    queries: versions.map(version => ({
      queryKey: [
        ...resourceQueryKeys.bibleRedWords(version),
        'availability',
        getOfflineResourceQuerySignal(resourceRegistry, {
          kind: 'bible-red-words',
          versionId: version,
        }),
      ],
      queryFn: () =>
        resources.bibleReading.getRedWordsAvailability?.(version) ??
        Promise.resolve({ status: 'available' as const }),
      enabled,
      networkMode: 'always' as const,
    })),
  })
  const redWordsQueries = useQueries({
    queries: versions.map((version, index) => ({
      queryKey: resourceQueryKeys.bibleRedWords(version),
      queryFn: () =>
        loadBibleReadingRedWords(
          { ...request, version, presentation: 'legacy-sidecars' },
          resources
        ),
      enabled: enabled && availabilityQueries[index]?.data?.status === 'available',
      staleTime: Infinity,
      ...localQueryOptions,
    })),
  })

  return useStableValue(
    Object.fromEntries(
      versions.map((version, index) => [version, redWordsQueries[index]?.data ?? null])
    ),
    versions.map((version, index) => `${version}:${redWordsQueries[index]?.dataUpdatedAt}`).join()
  )
}
