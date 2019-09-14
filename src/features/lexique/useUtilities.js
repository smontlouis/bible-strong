import { useEffect, useState, useRef, useCallback } from 'react'
import Sentry from 'sentry-expo'

import { getFirstLetterFrom } from '~helpers/alphabet'
import useDebounce from '~helpers/useDebounce'

export const useSectionResults = (results, debouncedSearchValue, sectionIndex, prop = 'Mot') => {
  const [sectionResults, setSectionResults] = useState(null)

  useEffect(() => {
    if (!results || !results.length) {
      if (!results) {
        Sentry.captureMessage('useSectionResults: Results is undefined', {
          extra: {
            debouncedSearchValue,
            sectionIndex,
            prop
          }
        })
      }
      return
    }

    let filteredResults = debouncedSearchValue
      ? (filteredResults = results.filter(
          c =>
            (c && c.Code && c.Code == debouncedSearchValue) ||
            c[prop].toLowerCase().includes(debouncedSearchValue.toLowerCase())
        ))
      : results

    const sectionResults = filteredResults.reduce((list, name) => {
      const listItem = list.find(
        item => item.title && item.title === getFirstLetterFrom(name[prop])
      )
      if (!listItem) {
        list.push({ title: getFirstLetterFrom(name[prop]), data: [name] })
      } else {
        listItem.data.push(name)
      }

      return list
    }, [])
    setSectionResults(debouncedSearchValue ? sectionResults : [sectionResults[sectionIndex]])
  }, [results, debouncedSearchValue, sectionIndex, prop])

  return sectionResults
}

export const useAlphabet = (results = [], prop = 'Mot') => {
  const [alphabet, setAlphabet] = useState([])
  useEffect(() => {
    const alphabet = results.reduce((list, name) => {
      const listItem = list.find(item => item === getFirstLetterFrom(name[prop]))
      if (!listItem) {
        list.push(getFirstLetterFrom(name[prop]))
      }
      return list
    }, [])
    setAlphabet(alphabet)
  }, [prop, results])

  return alphabet
}

export const useSearchValue = ({ onDebouncedValue }) => {
  const [searchValue, setSearchValue] = useState('')
  const debouncedSearchValue = useDebounce(searchValue, 300)

  useEffect(() => {
    if (!debouncedSearchValue) {
      onDebouncedValue()
    }
  }, [debouncedSearchValue, onDebouncedValue])

  return { searchValue, debouncedSearchValue, setSearchValue }
}

export const useResults = asyncFunc => {
  const [results, setResults] = useState([])
  useEffect(() => {
    asyncFunc().then(results => {
      if (!results) {
        Sentry.captureMessage('useResults: Results is undefined', {
          extra: {
            asyncFunc
          }
        })
      }
      setResults(results)
    })
  }, [asyncFunc])

  return results
}

export const useSectionIndex = () => {
  const [sectionIndex, setSectionIndex] = useState(0)

  const section = useRef()

  useEffect(() => {
    if (section && section.current) {
      section.current.scrollToLocation({
        sectionIndex: 0,
        itemIndex: 0,
        animated: false
      })
    }
  }, [sectionIndex])

  const resetSectionIndex = useCallback(() => {
    setSectionIndex(0)
  }, [])

  return { section, sectionIndex, setSectionIndex, resetSectionIndex }
}
