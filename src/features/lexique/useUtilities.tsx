import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/react-native'

import { DatabaseError } from '~helpers/catchDatabaseError'
import useDebounce from '~helpers/useDebounce'

interface UseSearchValueOptions {
  onDebouncedValue?: () => void
}

type QueryFunction<T> = (value: string) => Promise<T[] | DatabaseError>

interface QueryConfig<T> {
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

export const useResults = <T, P>(asyncFunc: (parameter: P) => Promise<T>, parameter: P) => {
  const [results, setResults] = useState<T | undefined>()
  useEffect(() => {
    asyncFunc(parameter).then(results => {
      if (!results) {
        Sentry.captureMessage('useResults: Results is undefined', {
          extra: {
            asyncFunc,
          },
        })
      }
      setResults(results)
    })
  }, [asyncFunc, parameter])

  return results
}

export const useResultsByLetterOrSearch = <T,>(
  search: QueryConfig<T> = {},
  letter: QueryConfig<T> = {}
) => {
  const [results, setResults] = useState<T[] | DatabaseError>([])
  const [isLoading, setLoading] = useState(true)
  useEffect(() => {
    if (search.value && search.query) {
      setLoading(true)
      search.query(search.value).then(results => {
        setResults(results)
        setLoading(false)
      })
      return
    }

    if (letter.value && letter.query) {
      setLoading(true)
      letter.query(letter.value).then(results => {
        setResults(results)
        setLoading(false)
      })
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.query, search.value, letter.query, letter.value])

  return { results, isLoading }
}
