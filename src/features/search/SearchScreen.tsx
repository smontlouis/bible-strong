import algoliasearch from 'algoliasearch/lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Configure, InstantSearch } from 'react-instantsearch-native'
import Container from '~common/ui/Container'
import useDebounce from '~helpers/useDebounce'
import useLanguage from '~helpers/useLanguage'
import i18n from '~i18n'
import { algoliaConfig } from '../../../config'
import Filters from './Filters'
import SearchBox from './SearchBox'
import SearchResults from './SearchResults'

const searchClient = algoliasearch(
  algoliaConfig.applicationId,
  algoliaConfig.apiKey
)

const SearchScreen = ({ navigation }) => {
  const { t } = useTranslation()
  const isFR = useLanguage()
  const [searchValue, setSearchValue] = React.useState('')
  const debouncedSearchValue = useDebounce(searchValue, 500)

  return (
    <>
      <InstantSearch indexName="bible-lsg" searchClient={searchClient}>
        <Configure restrictSearchableAttributes={isFR ? ['LSG'] : ['KJV']} />
        <Container>
          <SearchBox
            placeholder={t('search.placeholder')}
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

SearchScreen.navigationOptions = () => ({
  tabBarLabel: i18n.t('Rechercher'),
})

export default SearchScreen
