import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { LegendList } from '@legendapp/list'
import React, { useState } from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ConcordanceVerse from '~features/bible/ConcordanceVerse'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'
import type { Verse } from '~common/types'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { formatStrongLemmaPartOfSpeech } from './strongLemmaPartOfSpeech'
import type {
  LexiconBibleCountsResult,
  LexiconBibleLemmaStatsResult,
} from '~features/resources/lexiconBibleResourceAccess'

const PAGE_SIZE = 60
const PLACEHOLDER_COUNT = 6

const getMatchingAvailableResult = <
  TResult extends { status: string; provenance?: { versionId: string } },
>(
  result: TResult | undefined,
  versionId: string
): Extract<TResult, { status: 'available' }> | null => {
  if (!result || result.status !== 'available' || result.provenance?.versionId !== versionId) {
    return null
  }
  return result as Extract<TResult, { status: 'available' }>
}

const ConcordancePlaceholder = () => (
  <VStack minHeight={104} py={10} gap={7} borderBottomWidth={1} borderColor="border">
    <Box height={14} width="28%" borderRadius={4} bg="lightGrey" />
    <Box height={14} width="92%" borderRadius={4} bg="lightGrey" />
    <Box height={14} width="78%" borderRadius={4} bg="lightGrey" />
    <Box height={14} width="58%" borderRadius={4} bg="lightGrey" />
  </VStack>
)

type Props = {
  entry: StrongLexiconEntry
  currentVersionId: StrongBibleVersionId | 'BHG'
  defaultVersionId: StrongBibleVersionId
  preferredInterlinearLocale: ResourceLanguage
  onOpenVerse: (verse: Verse, version?: string) => void
}

const StrongConcordancePage = ({
  entry,
  currentVersionId,
  defaultVersionId,
  preferredInterlinearLocale,
  onOpenVerse,
}: Props) => {
  const { t, i18n } = useTranslation()
  const resources = useResourceAccess()
  const [selectedLemmaId, setSelectedLemmaId] = useState<number>()
  const request = {
    currentVersionId,
    defaultVersionId,
    preferredInterlinearLocale,
    book: entry.language === 'hebrew' ? 1 : 40,
    reference: entry.stepCode,
    allBooks: true,
  }
  const countsQuery = useQuery({
    queryKey: resourceQueryKeys.lexiconBibleCounts(request),
    queryFn: () => resources.lexiconBible.loadCountsByBook(request),
    networkMode: 'always',
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const lemmaQuery = useQuery({
    queryKey: resourceQueryKeys.lexiconBibleLemmaStats(request),
    queryFn: () => resources.lexiconBible.loadLemmaStats(request),
    networkMode: 'always',
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const concordanceQuery = useInfiniteQuery({
    queryKey: resourceQueryKeys.lexiconBibleConcordance({
      ...request,
      lexemeId: selectedLemmaId,
      limit: PAGE_SIZE,
    }),
    queryFn: ({ pageParam }) =>
      resources.lexiconBible.loadFoundVersesByBook({
        ...request,
        limit: PAGE_SIZE,
        pageToken: pageParam ?? undefined,
        lexemeId: selectedLemmaId,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: lastPage =>
      lastPage.status === 'available' ? lastPage.nextPageToken : undefined,
    networkMode: 'always',
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const verses =
    concordanceQuery.data?.pages.flatMap(page =>
      page.status === 'available' ? page.verses : []
    ) ?? []
  const availablePage = concordanceQuery.data?.pages.find(page => page.status === 'available')
  const version =
    availablePage?.status === 'available' ? availablePage.provenance.versionId : currentVersionId
  const counts = getMatchingAvailableResult<LexiconBibleCountsResult>(countsQuery.data, version)
  const lemmaStats = getMatchingAvailableResult<LexiconBibleLemmaStatsResult>(
    lemmaQuery.data,
    version
  )
  const count =
    selectedLemmaId == null
      ? counts
        ? counts.counts.reduce((total, current) => total + Number(current.versesCountByBook), 0)
        : verses.length
      : (lemmaStats?.lemmas.find(lemma => lemma.id === selectedLemmaId)?.occurrenceCount ??
        verses.length)

  const placeholders = (
    <VStack>
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <ConcordancePlaceholder key={index} />
      ))}
    </VStack>
  )

  return (
    <LegendList
      data={verses}
      estimatedItemSize={104}
      drawDistance={312}
      recycleItems
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 90 }}
      keyExtractor={verse => `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`}
      onEndReached={() => {
        if (concordanceQuery.hasNextPage && !concordanceQuery.isFetchingNextPage) {
          concordanceQuery.fetchNextPage()
        }
      }}
      onEndReachedThreshold={0.75}
      ListHeaderComponent={
        <>
          <HStack alignItems="baseline" gap={8}>
            <Text bold fontSize={32}>
              {count}
            </Text>
            <Text color="tertiary" fontSize={12}>
              {t('strongDetail.concordance.usesIn', { version })}
            </Text>
          </HStack>

          {lemmaStats && lemmaStats.lemmas.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20, marginTop: 16 }}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 7 }}
            >
              <TouchableBox onPress={() => setSelectedLemmaId(undefined)}>
                <Box
                  bg={selectedLemmaId == null ? 'primary' : 'lightGrey'}
                  borderRadius={16}
                  px={10}
                  py={7}
                >
                  <Text color={selectedLemmaId == null ? 'reverse' : 'default'} fontSize={12}>
                    {t('Tous')} ·{' '}
                    {counts
                      ? counts.counts.reduce(
                          (total, current) => total + Number(current.versesCountByBook),
                          0
                        )
                      : 0}
                  </Text>
                </Box>
              </TouchableBox>
              {lemmaStats.lemmas.map(lemma => (
                <TouchableBox key={lemma.id} onPress={() => setSelectedLemmaId(lemma.id)}>
                  <Box
                    bg={selectedLemmaId === lemma.id ? 'primary' : 'lightGrey'}
                    borderRadius={16}
                    px={10}
                    py={7}
                  >
                    <Text
                      color={selectedLemmaId === lemma.id ? 'reverse' : 'default'}
                      fontSize={12}
                    >
                      {lemma.lemma}{' '}
                      {formatStrongLemmaPartOfSpeech(lemma.partOfSpeech, i18n.language)} ·{' '}
                      {lemma.occurrenceCount}
                    </Text>
                  </Box>
                </TouchableBox>
              ))}
            </ScrollView>
          )}
        </>
      }
      ListHeaderComponentStyle={{ paddingBottom: 15 }}
      ListEmptyComponent={concordanceQuery.isPending ? placeholders : null}
      ListFooterComponent={concordanceQuery.isFetchingNextPage ? placeholders : null}
      renderItem={({ item }) => (
        <ConcordanceVerse
          onOpenVerse={verse => onOpenVerse(verse, version)}
          t={t}
          concordanceFor={String(entry.baseCode)}
          verse={item}
        />
      )}
    />
  )
}

export default StrongConcordancePage
