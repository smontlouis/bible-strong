import React from 'react'
import algoliasearch from 'algoliasearch/lite'
import { InstantSearch } from 'react-instantsearch-native'
import * as FileSystem from 'expo-file-system'

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

const useDeleteOldIndex = () => {
  React.useEffect(() => {
    const deleteFileIndex = async () => {
      const path = `${FileSystem.documentDirectory}idx-light.json`
      const file = await FileSystem.getInfoAsync(path)

      if (file.exists) {
        FileSystem.deleteAsync(file.uri)
      }
    }

    deleteFileIndex()
  }, [])
}

const SearchScreen = () => {
  const [searchValue, setSearchValue] = React.useState('')
  const debouncedSearchValue = useDebounce(searchValue, 500)

  // Delete old index
  useDeleteOldIndex()

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
