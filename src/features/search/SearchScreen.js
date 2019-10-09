import React, { useState, useEffect, useRef } from 'react'
import { ScrollView } from 'react-native'
import * as Sentry from 'sentry-expo'

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
import DropdownMenu from '~common/DropdownMenu'
import booksDesc from '~assets/bible_versions/books-desc'

// Lazynesss
const books = [
  {
    Numero: 0,
    Nom: 'Tout',
    Chapitres: 0
  },
  ...booksDesc
].map(book => ({
  value: book.Numero,
  label: book.Nom
}))
// End lazyness

const sectionValues = [
  { value: '', label: 'Tout' },
  { value: 'at', label: 'Ancien Testament' },
  { value: 'nt', label: 'Nouveau Testament' }
]

const orderValues = [
  { value: '', label: 'Par pertinence' },
  { value: 'a', label: 'Par ordre alphabétique' }
]

const timeout = ms => new Promise(r => setTimeout(r, ms))

const SearchScreen = ({ idxFile }) => {
  const index = useRef()
  const [isLoading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState('')
  const debouncedSearchValue = useDebounce(searchValue, 300)
  const [results, setResults] = useState(null)

  const [section, setSection] = useState('')
  const [order, setOrder] = useState('')
  const [book, setBook] = useState(0)

  useEffect(() => {
    const setIndexCache = async () => {
      await timeout(1000)
      index.current = await loadIndexCache(idxFile)
      setLoading(false)
    }
    setIndexCache()
  }, [idxFile])

  useEffect(() => {
    const filterResults = results => {
      if (!section && !book && !order) {
        return results
      }

      if (order === 'a') {
        results.sort((a, b) => {
          const nameA = a.ref
          const nameB = b.ref
          if (nameA < nameB) return -1
          if (nameA > nameB) return 1
          return 0
        })
      }

      return results.filter(r => {
        let isPristine = true
        const [bookRef, chapterRef, verseRef] = r.ref.split('-')

        // by Section
        if (section) {
          switch (section) {
            case 'nt': {
              if (bookRef <= 39) isPristine = false
              break
            }
            case 'at': {
              if (bookRef > 39) isPristine = false
              break
            }
            default:
              break
          }
        }

        // by Book
        if (book) {
          if (book != bookRef) isPristine = false
        }

        return isPristine
      })
    }

    if (index.current) {
      if (debouncedSearchValue) {
        try {
          const results = index.current.search(debouncedSearchValue)
          setResults(filterResults(results))
        } catch (e) {
          Sentry.captureException(e)
          SnackBar.show('Une erreur est survenue.', 'danger')
        }
      } else {
        setResults(null)
      }
    }
  }, [book, debouncedSearchValue, index, order, searchValue, section, setResults])

  if (isLoading) {
    return <Loading message="Chargement de l'index..." />
  }

  return (
    <Container>
      <Header noBorder title="Recherche dans la Bible" />
      <SearchInput
        placeholder="Recherche par mot ou phrase"
        onChangeText={setSearchValue}
        value={searchValue}
        onDelete={() => setSearchValue('')}
      />
      <ScrollView
        horizontal
        style={{ maxHeight: 55, paddingHorizontal: 10 }}
        contentContainerStyle={{
          flexDirection: 'row'
        }}>
        <DropdownMenu
          title="Ordre"
          currentValue={order}
          setValue={setOrder}
          choices={orderValues}
        />
        <DropdownMenu
          title="Section"
          currentValue={section}
          setValue={setSection}
          choices={sectionValues}
        />
        <DropdownMenu title="Livre" currentValue={book} setValue={setBook} choices={books} />
      </ScrollView>
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
