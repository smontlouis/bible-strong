import { useEffect, useState } from 'react'
import { type QueryKey, useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'

import { DatabaseError } from '~helpers/catchDatabaseError'
import useDebounce from '~helpers/useDebounce'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'

interface UseSearchValueOptions {
  onDebouncedValue?: () => void
}

type QueryFunction<T> = (value: string) => Promise<T[] | DatabaseError>

interface QueryConfig<T> {
  queryKey?: QueryKey
  query?: QueryFunction<T>
  value?: string
}

export const useSearchValue = ({ onDebouncedValue }: UseSearchValueOptions = {}) => {
  const [searchValue, setSearchValue] = useState('')
  const debouncedSearchValue = useDebounce(searchValue, 300)

  useEffect(() => {
    if (!debouncedSearchValue && onDebouncedValue) {
      onDebouncedValue()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue])

  return { searchValue, debouncedSearchValue, setSearchValue }
}

export const useResultsByLetterOrSearch = <T,>(
  search: QueryConfig<T> = {},
  letter: QueryConfig<T> = {}
) => {
  const resourceLanguages = useAtomValue(resourcesLanguageAtom)
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const active = search.value && search.query ? search : letter
  const mode = active === search ? 'search' : 'letter'
  const enabled = Boolean(active.value && active.query)
  const resourceFamily = active.queryKey?.[0]
  const resourceLanguage =
    resourceFamily === 'strong-lexicon'
      ? resourceLanguages.STRONG
      : resourceFamily === 'dictionary'
        ? resourceLanguages.DICTIONNAIRE
        : resourceFamily === 'nave'
          ? resourceLanguages.NAVE
          : undefined
  const { data, isPending, isFetching } = useQuery({
    queryKey: [
      'resource-results',
      ...(active.queryKey ?? []),
      resourceLanguage,
      downloadCompletionSignal,
      mode,
      active.value ?? '',
    ],
    queryFn: () => active.query!(active.value!),
    enabled,
    staleTime: Infinity,
  })

  return {
    results: data ?? [],
    isLoading: enabled && (isPending || isFetching),
  }
}
