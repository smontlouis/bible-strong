import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'

import { SheetFlatList, Sheet, SheetHeader, type SheetRef } from '~common/sheet'
import { Image } from 'expo-image'
import Empty from '~common/Empty'
import { LinkBox } from '~common/Link'
import SearchInput from '~common/SearchInput'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import type { TimelineEventSummary } from '~features/resources/timelineAccess'
import { getTimelineImageUri } from './timelineImage'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useResourceAccess } from '~features/resources/resourceAccess'
import useDebounce from '~helpers/useDebounce'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'

interface Props {
  modalRef: React.RefObject<SheetRef | null>
}

const TimelineSearchResultItem = ({
  item,
  onPress,
}: {
  item: TimelineEventSummary
  onPress: (event: TimelineEventSummary) => void
}) => {
  const imageUri = getTimelineImageUri(item.images?.[0]?.file)

  return (
    <LinkBox px={16} py={14} onPress={() => onPress(item)} row>
      {!!imageUri && (
        <Box mr={20} width={70} height={70} borderRadius={10} bg="lightGrey" overflow="hidden">
          <Image
            contentFit="cover"
            style={{ width: 70, height: 70, borderRadius: 10 }}
            source={{ uri: imageUri }}
          />
        </Box>
      )}
      <Box flex>
        <Paragraph small fontFamily="title">
          {item.title}
          {item.dates ? ` (${item.dates})` : ''}
        </Paragraph>
        {item.description ? (
          <Paragraph small numberOfLines={2}>
            {item.description}
          </Paragraph>
        ) : null}
      </Box>
    </LinkBox>
  )
}

const SearchInTimelineModal = ({ modalRef }: Props) => {
  const pushRouteOnce = usePushRouteOnce()
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const language = useAtomValue(resourcesLanguageAtom).TIMELINE
  const [searchValue, setSearchValue] = useState('')
  const debouncedSearchValue = useDebounce(searchValue, 250)
  const hasSearched = Boolean(debouncedSearchValue.trim())
  const searchQuery = useQuery({
    queryKey: [...resourceQueryKeys.timeline(language), 'search', debouncedSearchValue.trim()],
    queryFn: () => resources.timeline.searchIndex(debouncedSearchValue.trim(), language),
    enabled: hasSearched,
    networkMode: 'always',
  })
  const results = searchQuery.data?.status === 'available' ? searchQuery.data.details : []

  const onClear = () => {
    setSearchValue('')
  }

  const onOpenEvent = (event: TimelineEventSummary) => {
    modalRef.current?.dismiss()
    pushRouteOnce({
      pathname: '/event',
      params: { slug: event.slug },
    })
  }

  return (
    <Sheet
      ref={modalRef}
      snapPoints={[1]}
      header={
        <SheetHeader>
          <Box px={16} pt={30} pb={12}>
            <SearchInput
              value={searchValue}
              onChangeText={setSearchValue}
              placeholder={t('Rechercher un événement dans la Bible')}
              onDelete={onClear}
              returnKeyType="search"
            />
          </Box>
        </SheetHeader>
      }
    >
      <SheetFlatList
        ItemSeparatorComponent={() => <Border />}
        data={results}
        keyExtractor={(item: TimelineEventSummary) => item.slug}
        ListHeaderComponent={
          !hasSearched ? (
            <Empty
              icon={require('~assets/images/empty-state-icons/search.svg')}
              message={t('Faites une recherche dans la Bible !')}
            />
          ) : results.length === 0 ? (
            <Empty source={require('~assets/images/empty.json')} message={t('Aucun résultat')} />
          ) : (
            <Box px={16} pb={4}>
              <Text title fontSize={16} color="grey">
                {t('{{nbHits}} occurences trouvées dans la bible', {
                  nbHits: results.length,
                })}
              </Text>
            </Box>
          )
        }
        renderItem={({ item }: { item: TimelineEventSummary }) => (
          <TimelineSearchResultItem item={item} onPress={onOpenEvent} />
        )}
      />
    </Sheet>
  )
}

export default SearchInTimelineModal
