import { twMerge } from '~common/ui/classNames'

import { pageContentStyle } from '~common/ui/PageContent'
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
  <VStack className="border-continuous overflow-hidden min-h-[104px] py-[10px] gap-[7px] border-b-[1px] border-border">
    <Box className="overflow-hidden border-continuous h-[14px] w-[28%] rounded-[4px] bg-light-grey" />
    <Box className="overflow-hidden border-continuous h-[14px] w-[92%] rounded-[4px] bg-light-grey" />
    <Box className="overflow-hidden border-continuous h-[14px] w-[78%] rounded-[4px] bg-light-grey" />
    <Box className="overflow-hidden border-continuous h-[14px] w-[58%] rounded-[4px] bg-light-grey" />
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
    <VStack className="overflow-hidden border-continuous">
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
      contentContainerStyle={[
        pageContentStyle,
        { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 90 },
      ]}
      keyExtractor={verse => `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`}
      onEndReached={() => {
        if (concordanceQuery.hasNextPage && !concordanceQuery.isFetchingNextPage) {
          concordanceQuery.fetchNextPage()
        }
      }}
      onEndReachedThreshold={0.75}
      ListHeaderComponent={
        <>
          <HStack className="overflow-hidden border-continuous items-baseline gap-[8px]">
            <Text className="font-bold text-[32px]">{count}</Text>
            <Text className="text-tertiary text-[12px]">
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
              <TouchableBox
                className="overflow-hidden border-continuous"
                onPress={() => setSelectedLemmaId(undefined)}
              >
                <Box
                  className={twMerge(
                    'overflow-hidden border-continuous',
                    twMerge(
                      selectedLemmaId == null ? 'bg-primary' : 'bg-light-grey',
                      'overflow-hidden border-continuous rounded-[16px] px-[10px] py-[7px]'
                    )
                  )}
                >
                  <Text
                    className={twMerge(
                      selectedLemmaId == null ? 'text-reverse' : 'text-default',
                      'text-[12px]'
                    )}
                  >
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
                <TouchableBox
                  className="overflow-hidden border-continuous"
                  key={lemma.id}
                  onPress={() => setSelectedLemmaId(lemma.id)}
                >
                  <Box
                    className={twMerge(
                      'overflow-hidden border-continuous',
                      twMerge(
                        selectedLemmaId === lemma.id ? 'bg-primary' : 'bg-light-grey',
                        'overflow-hidden border-continuous rounded-[16px] px-[10px] py-[7px]'
                      )
                    )}
                  >
                    <Text
                      className={twMerge(
                        selectedLemmaId === lemma.id ? 'text-reverse' : 'text-default',
                        'text-[12px]'
                      )}
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
