import algoliasearch from 'algoliasearch/lite'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Configure, InstantSearch } from 'react-instantsearch-native'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'
import { useQuota } from '~helpers/usePremium'
import { algoliaConfig } from '../../../config'
import Filters from './Filters'
import SearchBox from './SearchBox'
import SearchResults from './SearchResults'
import { useIsPremium } from '~helpers/usePremium'
import { RootState } from '~redux/modules/reducer'
import { useSelector } from 'react-redux'

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
  const isPremium = useIsPremium()

  const checkSearchQuota = useQuota('bibleSearch')
  const [canQuery, setCanQuery] = React.useState(true)
  const [submittedValue, setSubmittedValue] = React.useState('')
  const searchQuotaRemaining = useSelector(
    (state: RootState) => state.user.quota.bibleSearch.remaining
  )
  const [isDirty, setIsDirty] = React.useState(false)

  const onSubmit = (callback: Function, value: string) => {
    if (!value || (value && !isDirty)) {
      callback()
      setSubmittedValue(value)
      return
    }
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
            onChange={v => {
              setSearchValue(v)
              setIsDirty(true)
            }}
            onSubmit={onSubmit}
            onClear={onClear}
          />
          {!isPremium && (
            <Box px={20} alignItems="flex-end">
              <Text bold fontSize={10} color="grey">
                {t('premium.searchQuotaRemaining')}: {searchQuotaRemaining}/10
              </Text>
            </Box>
          )}
          <Filters />
          <SearchResults canQuery={canQuery} searchValue={submittedValue} />
        </>
      </InstantSearch>
    </>
  )
}

export default OnlineSearchScreen
