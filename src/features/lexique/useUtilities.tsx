import { useEffect, useState } from 'react'
import { type QueryKey, useQuery } from '@tanstack/react-query'
import { DatabaseError } from '~helpers/catchDatabaseError'
import useDebounce from '~helpers/useDebounce'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { useAtomValue } from 'jotai/react'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import { localQueryOptions } from '~helpers/queryOptions'
import { getDatabaseQueryErrorCode, unwrapDatabaseResult } from '~helpers/queryResult'

interface UseSearchValueOptions {
  onDebouncedValue?: () => void
}

type QueryFunction<T> = (value: string) => Promise<T[] | DatabaseError>

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
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const active = search.value && search.query ? search : letter
  const mode = active === search ? 'search' : 'letter'
  const enabled = Boolean(active.value && active.query)
  const { data, error, isPending, isFetching } = useQuery({
    queryKey: [
      'resource-results',
      ...(active.queryKey ?? []),
      active.resourceLanguage,
      downloadCompletionSignal,
      mode,
      active.value ?? '',
    ],
    queryFn: async () => unwrapDatabaseResult(await active.query!(active.value!)),
    enabled,
    staleTime: Infinity,
    ...localQueryOptions,
  })

  return {
    results: data ?? [],
    isLoading: enabled && (isPending || isFetching),
    error: getDatabaseQueryErrorCode(error),
  }
}
