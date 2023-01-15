import algoliasearch from 'algoliasearch/lite'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Configure, InstantSearch } from 'react-instantsearch-native'
import Container from '~common/ui/Container'
import useDebounce from '~helpers/useDebounce'
import useLanguage from '~helpers/useLanguage'
import { useQuota } from '~helpers/usePremium'
import { usePrevious } from '~helpers/usePrevious'
import { algoliaConfig } from '../../../config'
import Filters from './Filters'
import SearchBox from './SearchBox'
import SearchResults from './SearchResults'

const searchClient = algoliasearch(
  algoliaConfig.applicationId,
  algoliaConfig.apiKey
)

interface SearchScreenProps {
  searchValue: string
  setSearchValue: (value: string) => void
}

const OnlineSearchScreen = ({
  searchValue,
  setSearchValue,
}: SearchScreenProps) => {
  const { t } = useTranslation()
  const isFR = useLanguage()

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
        <>
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
        </>
      </InstantSearch>
    </>
  )
}

export default OnlineSearchScreen