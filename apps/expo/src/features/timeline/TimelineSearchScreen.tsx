import { pageContentStyle } from '~common/ui/PageContent'
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
import { ListSectionTitle } from '~common/ui/ListSection'
import Paragraph from '~common/ui/Paragraph'
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
    <LinkBox className="px-[20px] py-[14px] flex-row" onPress={() => onPress(item)}>
      {!!imageUri && (
        <Box className="border-continuous overflow-visible mr-[16px] w-[70px] h-[70px] rounded-[8px] bg-light-grey">
          <Image
            contentFit="cover"
            style={{ width: 70, height: 70, borderRadius: 8 }}
            source={{ uri: imageUri }}
          />
        </Box>
      )}
      <Box className="overflow-hidden border-continuous flex-[1]">
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

// Starts where the text of the row above starts, after its thumbnail when it has one.
const TimelineSearchSeparator = ({ leadingItem }: { leadingItem?: TimelineEventSummary }) => (
  <Border
    className={getTimelineImageUri(leadingItem?.images?.[0]?.file) ? 'ml-[106px]' : 'ml-[20px]'}
  />
)

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
        <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center py-[60px]">
          <ActivityIndicator />
        </Box>
      )
    }

    return (
      <Empty
        {...(hasSearched
          ? { message: t('Aucun résultat') }
          : {
              icon: require('~assets/images/empty-state-icons/search.svg'),
              message: t('Faites une recherche dans la Bible !'),
            })}
      />
    )
  }

  return (
    <FormSheetScreen className="flex-[1] bg-reverse" isFormSheet={IS_FORM_SHEET}>
      <Header title={t('Recherche')} hasBackButton isModal={IS_FORM_SHEET} background>
        <Box className="overflow-hidden border-continuous px-[16px] pb-[12px]">
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
          contentContainerStyle={[pageContentStyle, { flexGrow: 1 }]}
          ItemSeparatorComponent={TimelineSearchSeparator}
          ListHeaderComponent={
            results.length > 0 ? (
              <ListSectionTitle className="ml-[20px] mt-[16px] mb-[6px]">
                {t('{{nbHits}} occurences trouvées dans la bible', {
                  nbHits: results.length,
                })}
              </ListSectionTitle>
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
