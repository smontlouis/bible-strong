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
import { useTranslation } from 'react-i18next'

const searchClient = algoliasearch(
  algoliaConfig.applicationId,
  algoliaConfig.apiKey
)

const SearchScreen = () => {
  const { t } = useTranslation()
  const [searchValue, setSearchValue] = React.useState('')
  const debouncedSearchValue = useDebounce(searchValue, 500)

  return (
    <>
      <InstantSearch indexName="bible-lsg" searchClient={searchClient}>
        <Container>
          <Header title={t('Recherche dans la Bible')} />
          <SearchBox
            placeholder={t('Mot, phrase ou strong')}
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
