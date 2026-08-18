import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { useAtomValue } from 'jotai/react'
import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Keyboard } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import { LinkBox } from '~common/Link'
import SearchInput from '~common/SearchInput'
import Border from '~common/ui/Border'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { TimelineEventSummary } from '~features/resources/timelineAccess'
import useDebounce from '~helpers/useDebounce'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import { getTimelineImageUri } from './timelineImage'

interface Props {
  isFormSheet?: boolean
  onClose: () => void
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

const TimelineSearchOverlay = ({ isFormSheet = false, onClose }: Props) => {
  const pushRouteOnce = usePushRouteOnce()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const resources = useResourceAccess()
  const language = useAtomValue(resourcesLanguageAtom).TIMELINE
  const [searchValue, setSearchValue] = useState('')
  const debouncedSearchValue = useDebounce(searchValue, 250)
  const normalizedSearch = debouncedSearchValue.trim()
  const hasSearched = Boolean(normalizedSearch)
  const searchQuery = useQuery({
    queryKey: [...resourceQueryKeys.timeline(language), 'search', normalizedSearch],
    queryFn: () => resources.timeline.searchIndex(normalizedSearch, language),
    enabled: hasSearched,
    networkMode: 'always',
  })
  const results = searchQuery.data?.status === 'available' ? searchQuery.data.details : []

  const close = () => {
    Keyboard.dismiss()
    onClose()
  }

  const onOpenEvent = (event: TimelineEventSummary) => {
    Keyboard.dismiss()
    pushRouteOnce({
      pathname: '/event',
      params: { slug: event.slug },
    })
    onClose()
  }

  const renderEmptyState = () => {
    if (searchQuery.isFetching) {
      return (
        <Box flex center py={60}>
          <ActivityIndicator />
        </Box>
      )
    }

    return (
      <Empty
        {...(hasSearched
          ? { source: require('~assets/images/empty.json'), message: t('Aucun résultat') }
          : {
              icon: require('~assets/images/empty-state-icons/search.svg'),
              message: t('Faites une recherche dans la Bible !'),
            })}
      />
    )
  }

  return (
    <Box absoluteFill zIndex={100} bg="reverse">
      <KeyboardAvoidingView automaticOffset behavior="padding" style={{ flex: 1 }}>
        <Box
          row
          alignItems="center"
          gap={8}
          px={16}
          paddingTop={(isFormSheet ? 12 : insets.top) + 12}
          pb={12}
          borderBottomWidth={1}
          borderColor="border"
        >
          <Box flex>
            <SearchInput
              autoFocus
              value={searchValue}
              onChangeText={setSearchValue}
              placeholder={t('Rechercher un événement dans la Bible')}
              onDelete={() => setSearchValue('')}
              returnKeyType="search"
            />
          </Box>
          <TouchableBox
            center
            size={44}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t('Fermer')}
          >
            <FeatherIcon name="x" size={24} />
          </TouchableBox>
        </Box>

        <FlatList
          data={results}
          keyExtractor={item => item.slug}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: insets.bottom + 16,
          }}
          ItemSeparatorComponent={() => <Border />}
          ListHeaderComponent={
            results.length > 0 ? (
              <Box px={16} py={10}>
                <Text title fontSize={16} color="grey">
                  {t('{{nbHits}} occurences trouvées dans la bible', {
                    nbHits: results.length,
                  })}
                </Text>
              </Box>
            ) : null
          }
          ListEmptyComponent={renderEmptyState}
          renderItem={({ item }) => <TimelineSearchResultItem item={item} onPress={onOpenEvent} />}
        />
      </KeyboardAvoidingView>
    </Box>
  )
}

export default TimelineSearchOverlay
