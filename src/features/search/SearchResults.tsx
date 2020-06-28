import React from 'react'

import InfiniteHits from './InfiniteHits'
import Empty from '~common/Empty'
import { useTranslation } from 'react-i18next'

const SearchResults = ({ searchValue }) => {
  const { t } = useTranslation()
  if (!searchValue) {
    return (
      <Empty
        source={require('~assets/images/search-loop.json')}
        message={t('Faites une recherche dans la Bible !')}
      />
    )
  }

  return <InfiniteHits searchValue={searchValue} />
}

export default SearchResults
