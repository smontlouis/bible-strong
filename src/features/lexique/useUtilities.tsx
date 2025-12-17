import { useEffect, useState, useRef, useCallback } from 'react'
import * as Sentry from '@sentry/react-native'

import useDebounce from '~helpers/useDebounce'

export const useSearchValue = ({ onDebouncedValue }: any = {}) => {
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

export const useResults = (asyncFunc: any, parameter: any) => {
  const [results, setResults] = useState<any>([])
  useEffect(() => {
    asyncFunc(parameter).then((results: any) => {
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

export const useResultsByLetterOrSearch = (search: any = {}, letter: any = {}) => {
  const [results, setResults] = useState<any>([])
  const [isLoading, setLoading] = useState(true)
  useEffect(() => {
    if (search.value) {
      setLoading(true)
      search.query(search.value).then((results: any) => {
        setResults(results)
        setLoading(false)
      })
      return
    }

    if (letter.value) {
      setLoading(true)
      letter.query(letter.value).then((results: any) => {
        setResults(results)
        setLoading(false)
      })
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.query, search.value, letter.query, letter.value])

  return { results, isLoading }
}
