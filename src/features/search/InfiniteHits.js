import React from 'react'
import { connectInfiniteHits, connectStateResults } from 'react-instantsearch-native'
import { FlatList } from 'react-native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Loading from '~common/Loading'

import Empty from '~common/Empty'
import Highlight from './Highlight'

const InfiniteHits = ({
  searchValue,
  hits,
  hasMore,
  refine,
  allSearchResults,
  error,
  searching,
  ...props
}) => {
  if (error) {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message={"Une erreur est survenue. Assurez-vous d'être connecté à Internet."}
      />
    )
  }

  return (
    <Box flex paddingTop={20}>
      <FlatList
        ListHeaderComponent={
          <Box paddingHorizontal={20}>
            <Text title fontSize={16} color="grey">
              {allSearchResults?.nbHits} occurences trouvées dans la bible
            </Text>
          </Box>
        }
        data={hits}
        keyExtractor={item => item.objectID}
        onEndReached={() => hasMore && refine()}
        renderItem={({ item }) => <Highlight attribute="LSG" hit={item} />}
      />
    </Box>
  )
}

export default connectInfiniteHits(connectStateResults(InfiniteHits))
