import React from 'react'

import InfiniteHits from './InfiniteHits'
import Empty from '~common/Empty'

const SearchResults = ({ searchValue }: any) => {
  if (!searchValue) {
    return (
      <Empty
        icon={require('~assets/images/empty-state-icons/search.svg')}
        message="Faites une recherche dans la Timeline !"
      />
    )
  }

  // @ts-ignore
  return <InfiniteHits searchValue={searchValue} />
}

export default SearchResults
