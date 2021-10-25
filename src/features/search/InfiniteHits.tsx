import React from 'react'
import {
  connectInfiniteHits,
  connectStateResults,
} from 'react-instantsearch-native'
import FlatList from '~common/ui/FlatList'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import LexiqueResultsWidget from '~features/lexique/LexiqueResultsWidget'
import DictionnaryResultsWidget from '~features/dictionnary/DictionnaryResultsWidget'
import NaveResultsWidget from '~features/nave/NaveResultsWidget'

import Empty from '~common/Empty'
import Highlight from './Highlight'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'
import VerseResultWidget from '~features/bible/VerseResultWidget'

interface Props {
  searchValue: string
  hits: any
  hasMore: boolean
  refineNext: () => void
  allSearchResults: any
  error?: boolean
  searching: boolean
}

const InfiniteHits = ({
  searchValue,
  hits,
  hasMore,
  refineNext,
  allSearchResults,
  error,
}: Props) => {
  const { t } = useTranslation()
  const isFR = useLanguage()
  return (
    <Box flex>
      <FlatList
        ListHeaderComponent={
          <Box>
            <Box row wrap padding={20}>
              <LexiqueResultsWidget searchValue={searchValue} />
              <DictionnaryResultsWidget searchValue={searchValue} />
              <NaveResultsWidget searchValue={searchValue} />
              <VerseResultWidget searchValue={searchValue} />
            </Box>
            {error ? (
              <Empty
                source={require('~assets/images/empty.json')}
                message={t(
                  "Une erreur est survenue. Assurez-vous d'être connecté à Internet."
                )}
              />
            ) : (
              <Box paddingHorizontal={20}>
                <Text title fontSize={16} color="grey">
                  {t('{{nbHits}} occurences trouvées dans la bible', {
                    nbHits: allSearchResults?.nbHits,
                  })}
                </Text>
              </Box>
            )}
          </Box>
        }
        data={hits}
        keyExtractor={item => item.objectID}
        onEndReached={() => hasMore && refineNext()}
        renderItem={({ item }) => (
          <Highlight attribute={isFR ? 'LSG' : 'KJV'} hit={item} />
        )}
      />
    </Box>
  )
}

export default connectInfiniteHits(connectStateResults(InfiniteHits))
