import React, { useEffect } from 'react'
import { Modalize } from 'react-native-modalize'
import { Theme } from '~themes'
import { useTheme } from '@emotion/react'

import { TimelineEvent as TimelineEventProps } from './types'
import useDebounce from '~helpers/useDebounce'

import SearchBox from '~features/search/SearchBox'
import Filters from './Filters'
import {
  connectInfiniteHits,
  connectStateResults,
} from 'react-instantsearch-native'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Highlight from './Highlight'
import Snippet from './Snippet'
import Border from '~common/ui/Border'
import { LinkBox } from '~common/Link'
import FastImage from 'react-native-fast-image'
import Empty from '~common/Empty'
import { useTranslation } from 'react-i18next'
import { usePrevious } from '~helpers/usePrevious'
import { useQuota } from '~helpers/usePremium'

interface Props {
  modalRef: React.RefObject<Modalize>
  eventModalRef: React.RefObject<Modalize>
  setEvent: (event: Partial<TimelineEventProps>) => void
}
const SearchInTimelineModal = ({
  modalRef,
  hits,
  hasMore,
  refine,
  allSearchResults,
  error,
  searching,
  setEvent,
  eventModalRef,
}: Props) => {
  const { t } = useTranslation()
  const theme: Theme = useTheme()
  const [searchValue, setSearchValue] = React.useState('')
  const debouncedSearchValue = useDebounce(searchValue, 500)
  const previousValue = usePrevious(debouncedSearchValue)
  const checkSearchQuota = useQuota('timelineSearch')
  const [canQuery, setCanQuery] = React.useState(true)

  useEffect(() => {
    if (previousValue !== debouncedSearchValue && debouncedSearchValue) {
      checkSearchQuota(
        () => {
          setCanQuery(true)
        },
        () => {
          setCanQuery(false)
        }
      )
    }
  }, [debouncedSearchValue, previousValue, checkSearchQuota])

  const onOpenEvent = event => {
    eventModalRef.current?.open()
    setEvent(event)
  }

  return (
    <Modalize
      ref={modalRef}
      modalStyle={{
        backgroundColor: theme.colors.lightGrey,
        maxWidth: 600,
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
      HeaderComponent={
        <Box pt={20}>
          <SearchBox
            debouncedValue={debouncedSearchValue}
            value={searchValue}
            onChange={setSearchValue}
            placeholder={t('Rechercher un événement dans la Bible')}
          />
          <Filters />
        </Box>
      }
      flatListProps={{
        ItemSeparatorComponent: () => <Border />,

        data: debouncedSearchValue ? hits : [],
        keyExtractor: item => item.objectID,
        onEndReached: () => {
          hasMore && refine()
        },
        ListHeaderComponent:
          !debouncedSearchValue || !canQuery ? (
            <Empty
              source={require('~assets/images/search-loop.json')}
              message={t('Faites une recherche dans la Bible !')}
            />
          ) : error ? (
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
          ),
        renderItem: ({ item }) => (
          <LinkBox mx={20} my={20} onPress={() => onOpenEvent(item)} row>
            {item.image && (
              <Box mr={20}>
                <FastImage
                  style={{ width: 70, height: 70, borderRadius: 10 }}
                  source={{
                    uri: item.image,
                  }}
                />
              </Box>
            )}
            <Box>
              <Highlight attribute="title" hit={item} />
              <Snippet attribute="description" hit={item} />
              <Snippet attribute="article" hit={item} />
            </Box>
          </LinkBox>
        ),
      }}
    />
  )
}

export default connectInfiniteHits(connectStateResults(SearchInTimelineModal))
