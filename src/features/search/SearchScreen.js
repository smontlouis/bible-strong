import React from 'react'
import algoliasearch from 'algoliasearch/lite'
import { InstantSearch } from 'react-instantsearch-native'
import * as FileSystem from 'expo-file-system'

import Header from '~common/Header'
import Container from '~common/ui/Container'
import SearchBox from './SearchBox'
import Filters from './Filters'
import InfiniteHits from './InfiniteHits'

import { algoliaConfig } from '../../../config'

const searchClient = algoliasearch(algoliaConfig.applicationId, algoliaConfig.apiKey)

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
  const [searchState, setSearchState] = React.useState({ query: '' })

  // Delete old index
  useDeleteOldIndex()

  return (
    <InstantSearch
      indexName="bible-lsg"
      searchClient={searchClient}
      searchState={searchState}
      onSearchStateChange={setSearchState}>
      <Container>
        <Header title="Recherche dans la Bible" />
        <SearchBox setSearchState={setSearchState} />
        <Filters />
        <InfiniteHits searchState={searchState} />
      </Container>
    </InstantSearch>
  )
}

export default SearchScreen
