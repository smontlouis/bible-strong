import React, { useState } from 'react'
import { Keyboard } from 'react-native'
import { useTranslation } from 'react-i18next'

import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Empty from '~common/Empty'
import { LinkBox } from '~common/Link'
import SearchInput from '~common/SearchInput'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import bibleMemoize from '~helpers/bibleStupidMemoize'
import { useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { TimelineEventDetail, TimelineEvent as TimelineEventProps } from './types'

interface Props {
  modalRef: React.RefObject<BottomSheet | null>
  eventModalRef: React.RefObject<BottomSheet | null>
  setEvent: (event: Partial<TimelineEventProps>) => void
}

const SearchInTimelineModal = ({ modalRef, setEvent, eventModalRef }: Props) => {
  const { t } = useTranslation()
  const [searchValue, setSearchValue] = useState('')
  const [results, setResults] = useState<TimelineEventDetail[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const doSearch = (query: string) => {
    if (!query.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    const timeline = bibleMemoize.timeline as TimelineEventDetail[] | undefined
    if (!timeline) {
      setResults([])
      setHasSearched(true)
      return
    }

    const lowerQuery = query.toLowerCase()
    const filtered = timeline.filter(event => {
      const title = event.title?.toLowerCase() ?? ''
      const description = event.description?.toLowerCase() ?? ''
      const article = event.article?.toLowerCase() ?? ''
      return (
        title.includes(lowerQuery) ||
        description.includes(lowerQuery) ||
        article.includes(lowerQuery)
      )
    })

    setResults(filtered)
    setHasSearched(true)
  }

  const onSubmit = () => {
    Keyboard.dismiss()
    doSearch(searchValue)
  }

  const onClear = () => {
    setSearchValue('')
    setResults([])
    setHasSearched(false)
  }

  const onOpenEvent = (event: TimelineEventDetail) => {
    eventModalRef.current?.expand()
    setEvent(event as unknown as Partial<TimelineEventProps>)
  }

  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  return (
    <BottomSheet
      ref={modalRef}
      index={-1}
      snapPoints={['100%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      topInset={useSafeAreaInsets().top + 56}
      key={key}
      {...bottomSheetStyles}
    >
      <Box pt={20}>
        <Box px={20}>
          <SearchInput
            value={searchValue}
            onChangeText={setSearchValue}
            placeholder={t('Rechercher un événement dans la Bible')}
            onDelete={onClear}
            onSubmitEditing={onSubmit}
            returnKeyType="search"
          />
        </Box>
      </Box>
      <BottomSheetFlatList
        ItemSeparatorComponent={() => <Border />}
        data={results}
        keyExtractor={item => item.slug}
        ListHeaderComponent={
          !hasSearched ? (
            <Empty
              icon={require('~assets/images/empty-state-icons/search.svg')}
              message={t('Faites une recherche dans la Bible !')}
            />
          ) : results.length === 0 ? (
            <Empty source={require('~assets/images/empty.json')} message={t('Aucun résultat')} />
          ) : (
            <Box paddingHorizontal={20}>
              <Text title fontSize={16} color="grey">
                {t('{{nbHits}} occurences trouvées dans la bible', {
                  nbHits: results.length,
                })}
              </Text>
            </Box>
          )
        }
        renderItem={({ item }) => (
          <LinkBox mx={20} my={20} onPress={() => onOpenEvent(item)} row>
            {item.images?.[0]?.file && (
              <Box mr={20}>
                <Image
                  style={{ width: 70, height: 70, borderRadius: 10 }}
                  source={{ uri: item.images[0].file }}
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
        )}
      />
    </BottomSheet>
  )
}

export default SearchInTimelineModal
