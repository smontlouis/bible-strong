import algoliasearch from 'algoliasearch/lite'
import produce from 'immer'
import { PrimitiveAtom, useAtom } from 'jotai'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Configure, InstantSearch } from 'react-instantsearch-native'
import { NavigationStackProp } from 'react-navigation-stack'
import Container from '~common/ui/Container'
import useDebounce from '~helpers/useDebounce'
import useLanguage from '~helpers/useLanguage'
import { useQuota } from '~helpers/usePremium'
import { usePrevious } from '~helpers/usePrevious'
import i18n from '~i18n'
import { SearchTab } from '~state/tabs'
import { algoliaConfig } from '../../../config'
import Filters from './Filters'
import SearchBox from './SearchBox'
import SearchResults from './SearchResults'

const searchClient = algoliasearch(
  algoliaConfig.applicationId,
  algoliaConfig.apiKey
)

interface SearchScreenProps {
  navigation: NavigationStackProp
  searchAtom: PrimitiveAtom<SearchTab>
}

const SearchTabScreen = ({ navigation, searchAtom }: SearchScreenProps) => {
  const { t } = useTranslation()
  const isFR = useLanguage()

  const [searchTab, setSearchTab] = useAtom(searchAtom)

  const {
    data: { searchValue },
  } = searchTab

  const setSearchValue = (value: string) =>
    setSearchTab(
      produce(draft => {
        draft.data.searchValue = value
      })
    )

  const setTitle = (title: string) =>
    setSearchTab(
      produce(draft => {
        draft.title = title
      })
    )

  useEffect(() => {
    setTitle(searchValue || t('Recherche'))
  }, [searchValue])
  const debouncedSearchValue = useDebounce(searchValue, 500)
  const previousValue = usePrevious(debouncedSearchValue)
  const checkSearchQuota = useQuota('bibleSearch')
  const [canQuery, setCanQuery] = React.useState(true)

  useEffect(() => {
    if (previousValue !== debouncedSearchValue && debouncedSearchValue) {
      checkSearchQuota(
        () => {
          setCanQuery(true)
        },
        () => {
          setCanQuery(false)
        }
      )
    }
  }, [debouncedSearchValue, previousValue, checkSearchQuota])

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
          <SearchResults
            canQuery={canQuery}
            searchValue={debouncedSearchValue}
          />
        </Container>
      </InstantSearch>
    </>
  )
}

SearchTabScreen.navigationOptions = () => ({
  tabBarLabel: i18n.t('Rechercher'),
})

export default SearchTabScreen
