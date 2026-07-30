import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { LegendList } from '@legendapp/list'
import { useAtomValue } from 'jotai/react'
import React, { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ConcordanceVerse from '~features/bible/ConcordanceVerse'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import {
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import type { Verse } from '~common/types'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import { formatStrongLemmaPartOfSpeech } from './strongLemmaPartOfSpeech'

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
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const [selectedLemmaId, setSelectedLemmaId] = useState<number>()
  const sourceKey = `${currentVersionId}:${defaultVersionId}:${preferredInterlinearLocale}:${entry.selectedIdentity.kind}:${entry.selectedIdentity.code}:${downloadCompletionSignal}`
  const [fallbackSource, setFallbackSource] = useState<{
    key: string
    versionId?: StrongBibleVersionId
  }>({ key: sourceKey })
  const effectiveCurrentVersionId =
    fallbackSource.key === sourceKey && fallbackSource.versionId
      ? fallbackSource.versionId
      : currentVersionId
  const request = {
    currentVersionId: effectiveCurrentVersionId,
    defaultVersionId,
    preferredInterlinearLocale,
    book: entry.language === 'hebrew' ? 1 : 40,
    reference: entry.selectedIdentity.code,
    allBooks: true,
  }
  const countsQuery = useQuery({
    queryKey: [
      'strong-detail',
      'concordance-counts',
      effectiveCurrentVersionId,
      defaultVersionId,
      preferredInterlinearLocale,
      downloadCompletionSignal,
      entry.selectedIdentity,
    ],
    queryFn: () => resources.lexiconBible.loadCountsByBook(request),
    networkMode: 'always',
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const lemmaQuery = useQuery({
    queryKey: [
      'strong-detail',
      'lemma-stats',
      effectiveCurrentVersionId,
      defaultVersionId,
      preferredInterlinearLocale,
      downloadCompletionSignal,
      entry.selectedIdentity,
    ],
    queryFn: () => resources.lexiconBible.loadLemmaStats(request),
    networkMode: 'always',
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const concordanceQuery = useInfiniteQuery({
    queryKey: [
      'strong-detail',
      'concordance-pages',
      effectiveCurrentVersionId,
      defaultVersionId,
      preferredInterlinearLocale,
      downloadCompletionSignal,
      entry.selectedIdentity,
      selectedLemmaId,
      PAGE_SIZE,
    ],
    queryFn: ({ pageParam }) =>
      resources.lexiconBible.loadFoundVersesByBook({
        ...request,
        limit: PAGE_SIZE,
        offset: pageParam.offset,
        cursor: pageParam.cursor,
        lexemeId: selectedLemmaId,
      }),
    initialPageParam: { offset: 0, cursor: undefined as string | undefined },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.status !== 'available') return undefined
      if (lastPage.provenance.versionId === 'BHG') {
        return 'nextCursor' in lastPage && lastPage.nextCursor
          ? { cursor: lastPage.nextCursor, offset: pages.length * PAGE_SIZE }
          : undefined
      }
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
      return lastPage.verses.length < PAGE_SIZE
        ? undefined
        : { cursor: undefined, offset: pages.length * PAGE_SIZE }
    },
    networkMode: 'always',
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const resolvedFallbackVersionId = [
    countsQuery.data?.status === 'available' ? countsQuery.data.provenance.versionId : undefined,
    lemmaQuery.data?.status === 'available' ? lemmaQuery.data.provenance.versionId : undefined,
    concordanceQuery.data?.pages.find(page => page.status === 'available')?.status === 'available'
      ? concordanceQuery.data.pages.find(page => page.status === 'available')!.provenance.versionId
      : undefined,
  ].find((versionId): versionId is StrongBibleVersionId =>
    Boolean(versionId && versionId !== 'BHG' && isStrongCapableBibleVersion(versionId))
  )
  useEffect(() => {
    if (
      currentVersionId === 'BHG' &&
      effectiveCurrentVersionId === 'BHG' &&
      resolvedFallbackVersionId
    ) {
      setFallbackSource({ key: sourceKey, versionId: resolvedFallbackVersionId })
    }
  }, [currentVersionId, effectiveCurrentVersionId, resolvedFallbackVersionId, sourceKey])
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
      : effectiveCurrentVersionId

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
