import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import { twMerge } from '~common/ui/classNames'

import { pageContentStyle } from '~common/ui/PageContent'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { LegendList } from '@legendapp/list'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box, { HStack, TouchableBox, VStack, usePageBottomInset } from '~common/ui/Box'
import { ListSeparator } from '~common/ui/ListSection'
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

/** The list runs on the page ground, where the light grey is the tinted fill of a chip. */
const LemmaChip = ({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) => (
  <TouchableBox
    className={twMerge(
      'overflow-hidden border-continuous rounded-full px-[12px] py-[6px]',
      selected ? 'bg-primary' : 'bg-light-grey'
    )}
    accessibilityState={{ selected }}
    onPress={onPress}
  >
    <Text className={twMerge('text-[13px]', selected && 'text-reverse font-semibold')}>
      {label}
    </Text>
  </TouchableBox>
)

const VerseSeparator = () => <ListSeparator inset={0} />

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
  <VStack className="border-continuous overflow-hidden min-h-[104px] py-[10px] gap-[7px]">
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
  const bottomInset = usePageBottomInset()
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
    queryFn: async ({ pageParam }) => {
      const result = await resources.lexiconBible.loadFoundVersesByBook({
        ...request,
        limit: PAGE_SIZE,
        pageToken: pageParam ?? undefined,
        lexemeId: selectedLemmaId,
      })
      // Keep the last successful page and its cursor when the next read fails.
      if (result.status !== 'available') throw new Error('CONCORDANCE_UNAVAILABLE')
      return result
    },
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
    availablePage?.status === 'available'
      ? availablePage.provenance.versionId
      : countsQuery.data?.status === 'available'
        ? countsQuery.data.provenance.versionId
        : currentVersionId
  const counts = getMatchingAvailableResult<LexiconBibleCountsResult>(countsQuery.data, version)
  const lemmaStats = getMatchingAvailableResult<LexiconBibleLemmaStatsResult>(
    lemmaQuery.data,
    version
  )
  const count =
    selectedLemmaId == null
      ? counts
        ? counts.counts.reduce((total, current) => total + Number(current.versesCountByBook), 0)
        : undefined
      : lemmaStats?.lemmas.find(lemma => lemma.id === selectedLemmaId)?.occurrenceCount

  const hasError =
    concordanceQuery.isError ||
    countsQuery.isError ||
    lemmaQuery.isError ||
    countsQuery.data?.status === 'unavailable' ||
    lemmaQuery.data?.status === 'unavailable'
  const retrying = concordanceQuery.isFetching || countsQuery.isFetching || lemmaQuery.isFetching
  const errorNotice = hasError ? (
    <VStack className="gap-[10px] py-[16px]">
      <Text accessibilityRole="alert">{t('strongDetail.concordance.loadError')}</Text>
      <TouchableBox
        accessibilityRole="button"
        disabled={retrying}
        onPress={() => {
          if (concordanceQuery.isFetchNextPageError) void concordanceQuery.fetchNextPage()
          else if (concordanceQuery.isError) void concordanceQuery.refetch()
          if (countsQuery.isError || countsQuery.data?.status === 'unavailable')
            void countsQuery.refetch()
          if (lemmaQuery.isError || lemmaQuery.data?.status === 'unavailable')
            void lemmaQuery.refetch()
        }}
      >
        <Text className="text-primary">{t(retrying ? 'Chargement...' : 'Réessayer')}</Text>
      </TouchableBox>
    </VStack>
  ) : null

  const placeholders = (
    <VStack className="overflow-hidden border-continuous">
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <React.Fragment key={index}>
          {index > 0 && <VerseSeparator />}
          <ConcordancePlaceholder />
        </React.Fragment>
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
        { maxWidth: 600, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 90 + bottomInset },
      ]}
      keyExtractor={verse => `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`}
      onEndReached={() => {
        if (
          concordanceQuery.hasNextPage &&
          !concordanceQuery.isFetching &&
          !concordanceQuery.isError
        ) {
          concordanceQuery.fetchNextPage()
        }
      }}
      onEndReachedThreshold={0.75}
      ListHeaderComponent={
        <>
          <HStack className="overflow-hidden border-continuous items-baseline gap-[8px]">
            <Text className="font-semibold text-[32px]">{count ?? '—'}</Text>
            <Text className="text-grey text-[14px]">
              {t('strongDetail.concordance.usesIn', { version })}
            </Text>
          </HStack>

          {lemmaStats && lemmaStats.lemmas.length > 0 && (
            <HorizontalControlScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20, marginTop: 16 }}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
              <LemmaChip
                label={`${t('Tous')} · ${
                  counts
                    ? counts.counts.reduce(
                        (total, current) => total + Number(current.versesCountByBook),
                        0
                      )
                    : '—'
                }`}
                selected={selectedLemmaId == null}
                onPress={() => setSelectedLemmaId(undefined)}
              />
              {lemmaStats.lemmas.map(lemma => (
                <LemmaChip
                  key={lemma.id}
                  label={`${lemma.lemma} ${formatStrongLemmaPartOfSpeech(lemma.partOfSpeech, i18n.language)} · ${lemma.occurrenceCount}`}
                  selected={selectedLemmaId === lemma.id}
                  onPress={() => setSelectedLemmaId(lemma.id)}
                />
              ))}
            </HorizontalControlScrollView>
          )}
        </>
      }
      ListHeaderComponentStyle={{ paddingBottom: 15 }}
      ListEmptyComponent={
        concordanceQuery.isPending ? (
          placeholders
        ) : !concordanceQuery.isError ? (
          <Text>{t('strongDetail.concordance.empty')}</Text>
        ) : null
      }
      ListFooterComponent={
        <>
          {errorNotice}
          {concordanceQuery.isFetchingNextPage ? placeholders : null}
        </>
      }
      ItemSeparatorComponent={VerseSeparator}
      renderItem={({ item }) => (
        <ConcordanceVerse
          className="py-[12px]"
          separated={false}
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
