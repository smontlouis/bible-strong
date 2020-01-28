import React from 'react'

import ScrollView from '~common/ui/ScrollView'
import LexiqueResultsWidget from '~features/lexique/LexiqueResultsWidget'
import DictionnaryResultsWidget from '~features/dictionnary/DictionnaryResultsWidget'
import NaveResultsWidget from '~features/nave/NaveResultsWidget'
import InfiniteHits from './InfiniteHits'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'

const SearchResults = ({ searchValue }) => {
  if (!searchValue) {
    return (
      <Empty
        source={require('~assets/images/search-loop.json')}
        message="Faites une recherche dans la Bible !"
      />
    )
  }

  return (
    <ScrollView>
      <Box>
        <Box row wrap padding={20}>
          <LexiqueResultsWidget searchValue={searchValue} />
          <DictionnaryResultsWidget searchValue={searchValue} />
          <NaveResultsWidget searchValue={searchValue} />
        </Box>
        <InfiniteHits searchValue={searchValue} />
      </Box>
    </ScrollView>
  )
}

export default SearchResults
