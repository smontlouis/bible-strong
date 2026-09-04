import { useEffect, useState } from 'react'
import { type QueryKey, useInfiniteQuery } from '@tanstack/react-query'
import useDebounce from '~helpers/useDebounce'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { localQueryOptions } from '~helpers/queryOptions'
import {
  getResourceAccessErrorCode,
  ResourceAccessError,
} from '~features/resources/resourceAccessError'
import useConnection from '~helpers/useConnection'

interface UseSearchValueOptions {
  onDebouncedValue?: () => void
}

export const useSearchValue = ({ onDebouncedValue }: UseSearchValueOptions = {}) => {
  const [searchValue, setSearchValue] = useState('')
  const debouncedSearchValue = useDebounce(searchValue, 600)

  useEffect(() => {
    if (!debouncedSearchValue && onDebouncedValue) {
      onDebouncedValue()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchValue])

  return { searchValue, debouncedSearchValue, setSearchValue }
}

type Page<T> = { entries: T[]; nextCursor?: string } | { topics: T[]; nextCursor?: string }
type PageQuery<T> = (
  value: string,
  options: { limit: number; cursor?: string; signal?: AbortSignal },
  resourceLanguage?: ResourceLanguage,
  resourceWork?: string
) => Promise<Page<T>>

export const useInfiniteResultsByLetterOrSearch = <T,>(
  search: {
    queryKey: QueryKey
    query: PageQuery<T>
    value: string
    resourceLanguage?: ResourceLanguage
    resourceWork?: string
  },
  letter: {
    queryKey: QueryKey
    query: PageQuery<T>
    value: string
    resourceLanguage?: ResourceLanguage
    resourceWork?: string
  },
  limit = 50
) => {
  const isConnected = useConnection()
  const active = search.value ? search : letter
  const mode = active === search ? 'search' : 'letter'
  const query = useInfiniteQuery({
    queryKey: [
      'resource-infinite-results',
      ...active.queryKey,
      active.resourceLanguage,
      active.resourceWork,
      mode,
      active.value,
      isConnected,
    ],
    queryFn: ({ pageParam, signal }) =>
      active.query(
        active.value,
        { signal, limit, ...(pageParam ? { cursor: pageParam } : {}) },
        active.resourceLanguage,
        active.resourceWork
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor,
    staleTime: Infinity,
    retry: false,
    ...localQueryOptions,
  })
  return {
    results: (query.data?.pages ?? []).flatMap(page =>
      'entries' in page ? page.entries : page.topics
    ),
    isLoading: query.isPending,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
    hasNextPage: query.hasNextPage,
    error: getResourceAccessErrorCode(query.error),
    recoveries: query.error instanceof ResourceAccessError ? query.error.recoveries : [],
    retry: () => void query.refetch(),
  }
}
