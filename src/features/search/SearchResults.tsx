import React from 'react'

import InfiniteHits from './InfiniteHits'
import Empty from '~common/Empty'
import { useTranslation } from 'react-i18next'

interface SearchResultProps {
  searchValue: string
  canQuery: boolean
}

const SearchResults = ({ searchValue, canQuery }: SearchResultProps) => {
  const { t } = useTranslation()
  if (!searchValue || !canQuery) {
    return (
      <Empty
        source={require('~assets/images/search-loop.json')}
        message={t('Faites une recherche dans la Bible !')}
      />
    )
  }

  {
    /* @ts-ignore */
  }
  return <InfiniteHits searchValue={searchValue} />
}

export default SearchResults
