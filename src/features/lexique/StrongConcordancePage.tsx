import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import React, { useEffect, useRef, useState } from 'react'
import { ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ConcordanceVerse from '~features/bible/ConcordanceVerse'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'
import type { Verse } from '~common/types'

const PAGE_SIZE = 60
const PLACEHOLDER_COUNT = 6

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
  currentVersionId: StrongBibleVersionId
  defaultVersionId: StrongBibleVersionId
  onOpenVerse: (verse: Verse, version?: string) => void
}

const StrongConcordancePage = ({
  entry,
  currentVersionId,
  defaultVersionId,
  onOpenVerse,
}: Props) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const [selectedLemmaId, setSelectedLemmaId] = useState<number>()
  const [revealedVerseKeys, setRevealedVerseKeys] = useState<string[]>([])
  const readyVerseKeys = useRef(new Set<string>())
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
      PAGE_SIZE,
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
    placeholderData: previousData => previousData,
  })
  const verses =
    concordanceQuery.data?.pages.flatMap(page =>
      page.status === 'available' ? page.verses : []
    ) ?? []
  const verseKeys = verses.map(verse => `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`)
  const isReplacingResults =
    concordanceQuery.isPending ||
    (concordanceQuery.isFetching && !concordanceQuery.isFetchingNextPage)
  const hasHiddenVerses = verseKeys.some(key => !revealedVerseKeys.includes(key))
  const showPlaceholders =
    isReplacingResults || concordanceQuery.isFetchingNextPage || hasHiddenVerses
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

  useEffect(() => {
    readyVerseKeys.current.clear()
    setRevealedVerseKeys([])
  }, [selectedLemmaId])

  const markVerseReady = (verse: Verse) => {
    const key = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`
    readyVerseKeys.current.add(key)
    if (verseKeys.every(verseKey => readyVerseKeys.current.has(verseKey))) {
      setRevealedVerseKeys(verseKeys)
    }
  }

  const loadMoreIfNeeded = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height)
    if (
      distanceFromBottom < Math.max(640, layoutMeasurement.height * 1.5) &&
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
      scrollEventThrottle={32}
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

      <VStack mt={15}>
        {verses.map(verse => {
          const verseKey = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`
          return (
            <ConcordanceVerse
              key={`${selectedLemmaId ?? 'all'}-${verseKey}`}
              onOpenVerse={item => onOpenVerse(item, version)}
              onReady={markVerseReady}
              hiddenUntilReady={isReplacingResults || !revealedVerseKeys.includes(verseKey)}
              t={t}
              concordanceFor={String(entry.baseCode)}
              verse={verse}
            />
          )
        })}
        {showPlaceholders &&
          Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
            <ConcordancePlaceholder key={index} />
          ))}
      </VStack>
    </ScrollView>
  )
}

export default StrongConcordancePage
