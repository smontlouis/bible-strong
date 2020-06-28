import React from 'react'
import algoliasearch from 'algoliasearch/lite'
import { InstantSearch } from 'react-instantsearch-native'

import useDebounce from '~helpers/useDebounce'
import Header from '~common/Header'
import Container from '~common/ui/Container'

import SearchBox from './SearchBox'
import Filters from './Filters'
import SearchResults from './SearchResults'
import { algoliaConfig } from '../../../config'

const searchClient = algoliasearch(
  algoliaConfig.applicationId,
  algoliaConfig.apiKey
)

const SearchScreen = () => {
  const [searchValue, setSearchValue] = React.useState('')
  const debouncedSearchValue = useDebounce(searchValue, 500)

  return (
    <>
      <InstantSearch indexName="bible-lsg" searchClient={searchClient}>
        <Container>
          <Header title="Recherche dans la Bible" />
          <SearchBox
            debouncedValue={debouncedSearchValue}
            value={searchValue}
            onChange={setSearchValue}
          />
          <Filters />
          <SearchResults searchValue={debouncedSearchValue} />
        </Container>
      </InstantSearch>
    </>
  )
}

export default SearchScreen
