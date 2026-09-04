import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { useAtomValue } from 'jotai/react'
import React, { useState } from 'react'
import { ActivityIndicator, FlatList, Keyboard } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Header from '~common/Header'
import { LinkBox } from '~common/Link'
import SearchInput from '~common/SearchInput'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { TimelineEventSummary } from '~features/resources/timelineAccess'
import { IS_FORM_SHEET } from '~helpers/constants'
import useDebounce from '~helpers/useDebounce'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import { getTimelineImageUri } from './timelineImage'

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

const TimelineSearchScreen = () => {
  const pushRouteOnce = usePushRouteOnce()
  const { t } = useTranslation()
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

  const onOpenEvent = (event: TimelineEventSummary) => {
    Keyboard.dismiss()
    pushRouteOnce({
      pathname: '/event',
      params: { slug: event.slug },
    })
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
    <FormSheetScreen isFormSheet={IS_FORM_SHEET} flex={1} bg="reverse">
      <Header title={t('Recherche')} hasBackButton isModal={IS_FORM_SHEET} background>
        <Box px={16} pb={12}>
          <SearchInput
            autoFocus
            value={searchValue}
            onChangeText={setSearchValue}
            placeholder={t('Rechercher un événement dans la Bible')}
            onDelete={() => setSearchValue('')}
            returnKeyType="search"
          />
        </Box>
      </Header>

      <KeyboardAvoidingView
        automaticOffset
        behavior={IS_FORM_SHEET ? undefined : 'padding'}
        style={{ flex: 1 }}
      >
        <FlatList
          data={results}
          keyExtractor={item => item.slug}
          keyboardDismissMode={IS_FORM_SHEET ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ flexGrow: 1 }}
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
    </FormSheetScreen>
  )
}

export default TimelineSearchScreen
