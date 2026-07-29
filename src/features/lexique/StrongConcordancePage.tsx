import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import React, { useState } from 'react'
import { ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useTranslation } from 'react-i18next'

import Loading from '~common/Loading'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ConcordanceVerse from '~features/bible/ConcordanceVerse'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'
import type { StrongReference, Verse } from '~common/types'

const PAGE_SIZE = 30

type Props = {
  entry: StrongLexiconEntry
  legacyEntry: StrongReference
  currentVersionId: StrongBibleVersionId
  defaultVersionId: StrongBibleVersionId
  onOpenVerse: (verse: Verse, version?: string) => void
}

const StrongConcordancePage = ({
  entry,
  legacyEntry,
  currentVersionId,
  defaultVersionId,
  onOpenVerse,
}: Props) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const [selectedLemmaId, setSelectedLemmaId] = useState<number>()
  const request = {
    currentVersionId,
    defaultVersionId,
    book: entry.language === 'hebrew' ? 1 : 40,
    reference: entry.selectedIdentity.code,
    allBooks: true,
  }
  const countsQuery = useQuery({
    queryKey: ['strong-detail', 'concordance-counts', currentVersionId, entry.selectedIdentity],
    queryFn: () => resources.strongBible.loadCountsByBook(request),
    networkMode: 'always',
  })
  const lemmaQuery = useQuery({
    queryKey: ['strong-detail', 'lemma-stats', currentVersionId, entry.selectedIdentity],
    queryFn: () => resources.strongBible.loadLemmaStats(request),
    networkMode: 'always',
  })
  const concordanceQuery = useInfiniteQuery({
    queryKey: [
      'strong-detail',
      'concordance-pages',
      currentVersionId,
      entry.selectedIdentity,
      selectedLemmaId,
    ],
    queryFn: ({ pageParam }) =>
      resources.strongBible.loadFoundVersesByBook({
        ...request,
        limit: PAGE_SIZE,
        offset: pageParam,
        lexemeId: selectedLemmaId,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.status !== 'available') return undefined
      const expectedCount =
        selectedLemmaId == null
          ? countsQuery.data?.status === 'available'
            ? countsQuery.data.counts.reduce(
                (total, current) => total + Number(current.versesCountByBook),
                0
              )
            : undefined
          : lemmaQuery.data?.status === 'available'
            ? lemmaQuery.data.lemmas.find(lemma => lemma.id === selectedLemmaId)?.occurrenceCount
            : undefined
      const loadedCount = pages.reduce(
        (total, page) => total + (page.status === 'available' ? page.verses.length : 0),
        0
      )
      if (expectedCount != null && loadedCount >= expectedCount) return undefined
      return lastPage.verses.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE
    },
    networkMode: 'always',
  })
  const verses =
    concordanceQuery.data?.pages.flatMap(page =>
      page.status === 'available' ? page.verses : []
    ) ?? []
  const count =
    selectedLemmaId == null
      ? countsQuery.data?.status === 'available'
        ? countsQuery.data.counts.reduce(
            (total, current) => total + Number(current.versesCountByBook),
            0
          )
        : 0
      : lemmaQuery.data?.status === 'available'
        ? (lemmaQuery.data.lemmas.find(lemma => lemma.id === selectedLemmaId)?.occurrenceCount ?? 0)
        : 0
  const version =
    concordanceQuery.data?.pages.find(page => page.status === 'available')?.status === 'available'
      ? concordanceQuery.data.pages.find(page => page.status === 'available')!.provenance.versionId
      : currentVersionId

  const loadMoreIfNeeded = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height)
    if (
      distanceFromBottom < 320 &&
      concordanceQuery.hasNextPage &&
      !concordanceQuery.isFetchingNextPage
    ) {
      concordanceQuery.fetchNextPage()
    }
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      onScroll={loadMoreIfNeeded}
      scrollEventThrottle={120}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 90 }}
    >
      <HStack alignItems="baseline" gap={8}>
        <Text bold fontSize={32}>
          {count}
        </Text>
        <Text color="tertiary" fontSize={12}>
          {t('strongDetail.concordance.usesIn', { version })}
        </Text>
      </HStack>

      {lemmaQuery.data?.status === 'available' && lemmaQuery.data.lemmas.length > 0 && (
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
                {countsQuery.data?.status === 'available'
                  ? countsQuery.data.counts.reduce(
                      (total, current) => total + Number(current.versesCountByBook),
                      0
                    )
                  : 0}
              </Text>
            </Box>
          </TouchableBox>
          {lemmaQuery.data.lemmas.map(lemma => (
            <TouchableBox key={lemma.id} onPress={() => setSelectedLemmaId(lemma.id)}>
              <Box
                bg={selectedLemmaId === lemma.id ? 'primary' : 'lightGrey'}
                borderRadius={16}
                px={10}
                py={7}
              >
                <Text color={selectedLemmaId === lemma.id ? 'reverse' : 'default'} fontSize={12}>
                  {lemma.lemma} · {lemma.occurrenceCount}
                </Text>
              </Box>
            </TouchableBox>
          ))}
        </ScrollView>
      )}

      {concordanceQuery.isPending ? (
        <Loading />
      ) : (
        <VStack mt={15}>
          {verses.map(verse => (
            <ConcordanceVerse
              key={`${verse.Livre}-${verse.Chapitre}-${verse.Verset}`}
              onOpenVerse={item => onOpenVerse(item, version)}
              t={t}
              concordanceFor={String(entry.baseCode)}
              lexiconEntry={legacyEntry}
              verse={verse}
            />
          ))}
          {concordanceQuery.isFetchingNextPage && <Loading />}
        </VStack>
      )}
    </ScrollView>
  )
}

export default StrongConcordancePage
