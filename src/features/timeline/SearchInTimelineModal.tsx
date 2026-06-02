import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SheetFlatList, Sheet, type SheetRef } from '~common/sheet'
import { Image } from 'expo-image'
import Empty from '~common/Empty'
import { LinkBox } from '~common/Link'
import SearchInput from '~common/SearchInput'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import bibleMemoize from '~helpers/bibleStupidMemoize'
import { TimelineEventDetail } from './types'
import { getTimelineImageUri } from './timelineImage'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

interface Props {
  modalRef: React.RefObject<SheetRef | null>
}

const normalizeSearchText = (value?: string) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const getSearchScore = (event: TimelineEventDetail, query: string) => {
  const title = normalizeSearchText(event.title)
  const description = normalizeSearchText(event.description)
  const article = normalizeSearchText(event.article)

  if (title === query) return 0
  if (title.startsWith(query)) return 1
  if (title.split(/\W+/).includes(query)) return 2
  if (title.includes(query)) return 3
  if (description.startsWith(query)) return 4
  if (description.includes(query)) return 5
  if (article.includes(query)) return 6

  return Number.POSITIVE_INFINITY
}

const searchTimeline = (query: string) => {
  if (!query.trim()) {
    return { results: [], hasSearched: false }
  }

  const timeline = bibleMemoize.timeline as TimelineEventDetail[] | undefined
  if (!timeline) {
    return { results: [], hasSearched: true }
  }

  const lowerQuery = normalizeSearchText(query.trim())
  const results = timeline
    .map(event => ({ event, score: getSearchScore(event, lowerQuery) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      return a.event.title.localeCompare(b.event.title)
    })
    .map(({ event }) => event)

  return { results, hasSearched: true }
}

const TimelineSearchResultItem = ({
  item,
  onPress,
}: {
  item: TimelineEventDetail
  onPress: (event: TimelineEventDetail) => void
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
  const [searchValue, setSearchValue] = useState('')
  const [results, setResults] = useState<TimelineEventDetail[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const search = searchTimeline(searchValue)
      setResults(search.results)
      setHasSearched(search.hasSearched)
    }, 250)

    return () => clearTimeout(timeout)
  }, [searchValue])

  const onClear = () => {
    setSearchValue('')
    setResults([])
    setHasSearched(false)
  }

  const onOpenEvent = (event: TimelineEventDetail) => {
    modalRef.current?.dismiss()
    pushRouteOnce({
      pathname: '/event',
      params: { slug: event.slug },
    })
  }

  return (
    <Sheet ref={modalRef} snapPoints={[1]} dismissible backdrop>
      <Box pt={12}>
        <Box px={16}>
          <SearchInput
            value={searchValue}
            onChangeText={setSearchValue}
            placeholder={t('Rechercher un événement dans la Bible')}
            onDelete={onClear}
            returnKeyType="search"
          />
        </Box>
      </Box>
      <SheetFlatList
        ItemSeparatorComponent={() => <Border />}
        data={results}
        keyExtractor={(item: TimelineEventDetail) => item.slug}
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
        renderItem={({ item }: { item: TimelineEventDetail }) => (
          <TimelineSearchResultItem item={item} onPress={onOpenEvent} />
        )}
      />
    </Sheet>
  )
}

export default SearchInTimelineModal
