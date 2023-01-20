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

  const checkSearchQuota = useQuota('bibleSearch')
  const [canQuery, setCanQuery] = React.useState(true)
  const [submittedValue, setSubmittedValue] = React.useState('')

  const onSubmit = (callback: Function, value: string) => {
    checkSearchQuota(
      () => {
        setCanQuery(true)
        callback()
        setSubmittedValue(value)
      },
      () => {
        setCanQuery(false)
        setSubmittedValue('')
      }
    )
  }

  const onClear = () => {
    setSubmittedValue('')
    setSearchValue('')
  }

  return (
    <>
      <InstantSearch indexName="bible-lsg" searchClient={searchClient}>
        <Configure restrictSearchableAttributes={isFR ? ['LSG'] : ['KJV']} />
        <>
          <SearchBox
            placeholder={t('search.placeholder')}
            value={searchValue}
            onChange={setSearchValue}
            onSubmit={onSubmit}
            onClear={onClear}
          />
          <Filters />
          <SearchResults canQuery={canQuery} searchValue={submittedValue} />
        </>
      </InstantSearch>
    </>
  )
}

export default OnlineSearchScreen
