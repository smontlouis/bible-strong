import React, { useState, useEffect, useRef } from 'react'
import Sentry from 'sentry-expo'

import Header from '~common/Header'
import SearchInput from '~common/SearchInput'
import Container from '~common/ui/Container'
import Empty from '~common/Empty'
import SearchResults from './SearchResults'
import waitForIndex from './waitForIndex'
import useDebounce from '~helpers/useDebounce'
import loadIndexCache from './loadIndexCache'
import Loading from '~common/Loading'
import SnackBar from '~common/SnackBar'

const SearchScreen = ({ idxFile }) => {
  const index = useRef()
  const [isLoading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const [results, setResults] = useState(null)
  const debouncedSearchValue = useDebounce(searchValue, 300)

  useEffect(() => {
    const setIndexCache = async () => {
      index.current = await loadIndexCache(idxFile)
      setLoading(false)
    }
    setIndexCache()
  }, [idxFile])

  useEffect(() => {
    if (index.current) {
      if (debouncedSearchValue) {
        try {
          const results = index.current.search(debouncedSearchValue)
          setResults(results)
        } catch (e) {
          Sentry.captureException(e)
          Sentry.captureMessage(`User tried to search for ${searchValue}`)
          SnackBar.show('Une erreur est survenue.', 'danger')
        }
      } else {
        setResults(null)
      }
    }
  }, [debouncedSearchValue, index, searchValue, setResults])

  if (isLoading) {
    return <Loading message="Chargement de l'index..." />
  }

  return (
    <Container>
      <Header title="Recherche" />
      <SearchInput
        placeholder="Recherche par code ou par mot"
        onChangeText={setSearchValue}
        value={searchValue}
        onDelete={() => setSearchValue('')}
      />
      {debouncedSearchValue && Array.isArray(results) ? (
        <SearchResults results={results} />
      ) : (
        <Empty
          source={require('~assets/images/search-loop.json')}
          message="Fais une recherche dans la Bible !"
        />
      )}
    </Container>
  )
}

export default waitForIndex(SearchScreen)
