import React from 'react'

import InfiniteHits from './InfiniteHits'
import Empty from '~common/Empty'

const SearchResults = ({ searchValue }) => {
  if (!searchValue) {
    return (
      <Empty
        source={require('~assets/images/search-loop.json')}
        message="Faites une recherche dans la Bible !"
      />
    )
  }

  return <InfiniteHits searchValue={searchValue} />
}

export default SearchResults
