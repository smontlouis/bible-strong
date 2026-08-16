import { useEffect, useState } from 'react'
import { type QueryKey, useQuery } from '@tanstack/react-query'
import useDebounce from '~helpers/useDebounce'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { localQueryOptions } from '~helpers/queryOptions'
import {
  getResourceAccessErrorCode,
  ResourceAccessError,
} from '~features/resources/resourceAccessError'

interface UseSearchValueOptions {
  onDebouncedValue?: () => void
}

type QueryFunction<T> = (value: string) => Promise<T[]>

interface QueryConfig<T> {
  queryKey?: QueryKey
  query?: QueryFunction<T>
  value?: string
  resourceLanguage?: ResourceLanguage
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
  const active = search.value && search.query ? search : letter
  const mode = active === search ? 'search' : 'letter'
  const enabled = Boolean(active.value && active.query)
  const query = useQuery({
    queryKey: [
      'resource-results',
      ...(active.queryKey ?? []),
      active.resourceLanguage,
      mode,
      active.value ?? '',
    ],
    queryFn: () => active.query!(active.value!),
    enabled,
    staleTime: Infinity,
    ...localQueryOptions,
  })

  return {
    results: query.data ?? [],
    isLoading: enabled && (query.isPending || query.isFetching),
    error: getResourceAccessErrorCode(query.error),
    recoveries: query.error instanceof ResourceAccessError ? query.error.recoveries : [],
    retry: () => void query.refetch(),
  }
}
