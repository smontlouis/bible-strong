import { useQueries } from '@tanstack/react-query'
import type { Pericope } from '~common/types'
import type { ResourceAccessRegistry } from '~features/resources/resourceAccess'
import { getCanonicalChapterPericope } from '~helpers/canonicalBibleHeadings'
import { localQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { useStableValue } from '~helpers/useStableList'
import type { ParallelVerse, PericopeChapter } from '../BibleDOM/BibleDOMWrapper'

const isCanonicalParallel = (parallel: ParallelVerse) =>
  parallel.verses.some(verse => verse.TextRevision)

/**
 * The section headings of every parallel version, for the displayed chapter: canonical
 * chapters carry them, legacy versions have a pericope file.
 */
export const useParallelPericopes = ({
  parallelVerses,
  book,
  chapter,
  enabled,
  resources,
}: {
  parallelVerses: ParallelVerse[]
  book: number
  chapter: number
  enabled: boolean
  resources: ResourceAccessRegistry
}): Record<string, PericopeChapter | undefined> => {
  const legacyVersions = parallelVerses
    .filter(parallel => !parallel.error && parallel.verses.length > 0)
    .filter(parallel => !isCanonicalParallel(parallel))
    .map(parallel => parallel.id)
  const legacyPericopes = useQueries({
    queries: legacyVersions.map(version => ({
      queryKey: resourceQueryKeys.biblePericope(version),
      queryFn: () => resources.bibleReading.loadPericope(version),
      enabled,
      staleTime: Infinity,
      ...localQueryOptions,
    })),
  })

  const pericopes = parallelVerses.map(parallel => {
    const legacyIndex = legacyVersions.indexOf(parallel.id)
    const pericope: Pericope | null | undefined = isCanonicalParallel(parallel)
      ? getCanonicalChapterPericope(parallel.verses)
      : legacyPericopes[legacyIndex]?.data
    return [parallel.id, pericope?.[book]?.[chapter]] as const
  })

  return useStableValue(Object.fromEntries(pericopes), JSON.stringify(pericopes))
}
