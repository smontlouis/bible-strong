import algoliasearch from 'algoliasearch/lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Configure, InstantSearch } from 'react-instantsearch-native'
import useLanguage from '~helpers/useLanguage'
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
  const [canQuery, setCanQuery] = React.useState(true)
  const [submittedValue, setSubmittedValue] = React.useState('')

  const [isDirty, setIsDirty] = React.useState(false)

  // Refacto this because of quotas before

  const onSubmit = (callback: Function, value: string) => {
    if (!value || (value && !isDirty)) {
      callback()
      setSubmittedValue(value)
      return
    }

    callback()
    setSubmittedValue(value)
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
            onChange={v => {
              setSearchValue(v)
              setIsDirty(true)
            }}
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
