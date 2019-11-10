import { useEffect, useState, useRef, useCallback } from 'react'
import * as Sentry from 'sentry-expo'

import useDebounce from '~helpers/useDebounce'

export const useSearchValue = ({ onDebouncedValue } = {}) => {
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

export const useResults = (asyncFunc, parameter) => {
  const [results, setResults] = useState([])
  useEffect(() => {
    asyncFunc(parameter).then(results => {
      if (!results) {
        Sentry.captureMessage('useResults: Results is undefined', {
          extra: {
            asyncFunc
          }
        })
      }
      setResults(results)
    })
  }, [asyncFunc, parameter])

  return results
}

export const useResultsByLetterOrSearch = (search, letter) => {
  const [results, setResults] = useState([])
  const [isLoading, setLoading] = useState(true)
  useEffect(() => {
    if (search.value) {
      setLoading(true)
      search.query(search.value).then(results => {
        setResults(results)
        setLoading(false)
      })
    } else {
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
