import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { useEffect, useRef, useState } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import RoundedCorner from '~common/ui/RoundedCorner'
import CanonicalStrongVerseText from './CanonicalStrongVerseText'
import StrongCard from './StrongCard'

import BibleVerseDetailFooter from './BibleVerseDetailFooter'

import { useTranslation } from 'react-i18next'
import { FlatList, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { StudyNavigateBibleType } from '~common/types'
import Button from '~common/ui/Button'
import type {
  LexiconBibleProvenance,
  LexiconBibleVerseResult,
} from '~features/resources/lexiconBibleResourceAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import {
  resourceFailureFromAccessError,
  resourceFailureFromStrongModuleAvailability,
} from '~features/resources/resourceFailure'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import type { StrongLexiconEntryCard } from '~features/resources/strongLexiconAccess'
import { getChapterVerseCountFromCoverage } from '~helpers/bibleCoverage'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { localQueryOptions, staticResourceQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import {
  getStrongBibleFallbackPriority,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import { areStrongIdentitiesEqual, type StrongIdentity } from '~helpers/strongIdentities'
import { wp } from '~helpers/utils'
import type { RootState } from '~redux/modules/reducer'
import { useResourcesLanguageValue } from '~state/resourcesLanguage'
import type { VersionCode } from '~state/tabs'
import { scaleLineHeight } from './BibleDOM/scaleLineHeight'
import { getBibleTextFontSize } from './BibleDOM/verseTypography'
import {
  getStrongWordOccurrences,
  type StrongVerseContext,
  type StrongWordOccurrence,
} from './strongResourceCardContext'
import { StrongResourceScrollProvider } from './StrongResourceScrollContext'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth + itemHorizontalMargin * 2
const itemGap = 10
const carouselStep = itemWidth + itemGap

const VersetWrapper = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('w-[25px] mr-[5px] border-r-[3px] border-r-[transparent] items-end', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const NumberText = (
  componentProps: Omit<UIComponentProps<typeof Paragraph>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('mt-[0px] text-[9px] justify-end mr-[3px]', className)
  )
  return (
    <Paragraph
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof Paragraph>['style']}
    />
  )
}

const StyledVerse = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('pl-[0px] pr-[10px] mb-[5px] flex-row', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

interface Verse {
  Livre: number
  Chapitre: number
  Verset: number
  // Add other properties as needed
}

interface Props {
  verse: Verse
  selectedVersion: VersionCode
  preferredStrongVersionId?: StrongBibleVersionId
  preferredInterlinearLocale: ResourceLanguage
  onStrongBibleProvenanceChange?: (provenance: LexiconBibleProvenance | null) => void
  onOpenStrongBibleSourceSheet: () => void
  isSelectionMode?: StudyNavigateBibleType
  updateVerse: (direction: number) => void
}

type StrongVerseQueryErrorCode =
  | 'CORRUPTED_DATABASE'
  | 'DISK_IO'
  | 'UNKNOWN_ERROR'
  | 'STRONG_BIBLE_UNAVAILABLE'
  | 'STRONG_VERSE_NOT_INDEXED'

class StrongVerseQueryError extends Error {
  code: StrongVerseQueryErrorCode

  constructor(code: StrongVerseQueryErrorCode) {
    super(code)
    this.name = 'StrongVerseQueryError'
    this.code = code
  }
}

interface StrongCardItem {
  entry: StrongLexiconEntryCard
  context: StrongVerseContext
  occurrenceIndex: number
}

interface StrongVerseQueryData {
  formattedTexte: React.ReactElement<React.ComponentProps<typeof CanonicalStrongVerseText>> | null
  provenance: LexiconBibleProvenance | null
  displayedVerse: Verse | null
  strongIdentities: StrongIdentity[]
  strongOccurrences: StrongWordOccurrence[]
  sourceResult: Extract<LexiconBibleVerseResult, { status: 'available' }>
}

const BibleVerseDetailCard: React.FC<Props> = ({
  verse,
  selectedVersion,
  preferredStrongVersionId,
  preferredInterlinearLocale,
  onStrongBibleProvenanceChange,
  onOpenStrongBibleSourceSheet,
  isSelectionMode,
  updateVerse,
}) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const defaultStrongVersion = useSelector(
    (rootState: RootState) => rootState.user.bible.settings.defaultStrongBibleVersionId ?? 'LSG'
  )
  const fontSizeScale = useSelector(
    (rootState: RootState) => rootState.user.bible.settings.fontSizeScale
  )
  const lineHeightSetting = useSelector(
    (rootState: RootState) => rootState.user.bible.settings.lineHeight
  )
  const resources = useResourceAccess()
  const strongResourceLanguage = useResourcesLanguageValue().STRONG
  const verseBook = verse.Livre
  const verseChapter = verse.Chapitre
  const verseNumber = verse.Verset
  const verseScrollRef = useRef<ScrollView>(null)
  const strongCardsScrollRef = useRef<FlatList<StrongCardItem>>(null)
  const strongWordLayoutsRef = useRef(new Map<number, number>())
  const currentStrongCardIndexRef = useRef(0)
  const isProgrammaticCardsScrollRef = useRef(false)
  const hasDisplayedStrongVerseRef = useRef(false)
  const insets = useSafeAreaInsets()
  const [currentStrongCardIndex, setCurrentStrongCardIndex] = useState(0)
  const [modalContentHeight, setModalContentHeight] = useState(0)
  const coreAvailabilityQuery = useQuery({
    queryKey: resourceQueryKeys.strongLexiconAvailability('core'),
    queryFn: async () => ({
      availability: await resources.strongLexicon.getModuleAvailability('core'),
      recoveries: await resources.strongLexicon.getModuleRecoveryActions?.('core'),
    }),
    networkMode: 'always',
    staleTime: Infinity,
  })

  const lexiconVerseRequest = {
    currentVersionId: selectedVersion,
    defaultVersionId: defaultStrongVersion,
    preferredVersionId: preferredStrongVersionId,
    preferredInterlinearLocale,
    fallbackVersionIds: getStrongBibleFallbackPriority(selectedVersion),
    book: verseBook,
    chapter: verseChapter,
    verse: verseNumber,
  }
  const lexiconVerseQueryKeyRequest = {
    currentVersionId: selectedVersion,
    defaultVersionId: defaultStrongVersion,
    preferredInterlinearLocale,
    preferredVersionId: preferredStrongVersionId,
    resourceLanguage: strongResourceLanguage,
    book: verseBook,
    chapter: verseChapter,
    verse: verseNumber,
  }
  const toStrongVerseQueryData = (
    result: Extract<LexiconBibleVerseResult, { status: 'available' }>
  ): StrongVerseQueryData => {
    const strongVerse = result.verse
    const strongOccurrences = getStrongWordOccurrences(strongVerse)
    const strongIdentities = [
      ...new Map(
        strongOccurrences.map(occurrence => [
          `${occurrence.identity.kind}:${occurrence.identity.code}`,
          occurrence.identity,
        ])
      ).values(),
    ]

    return {
      formattedTexte: <CanonicalStrongVerseText verse={{ ...strongVerse, Livre: verseBook }} />,
      provenance: result.provenance,
      strongIdentities,
      strongOccurrences,
      sourceResult: result,
      displayedVerse: {
        Livre: verseBook,
        Chapitre: verseChapter,
        Verset: verseNumber,
      },
    }
  }
  const strongVerseQuery = useQuery({
    queryKey: resourceQueryKeys.lexiconBibleVerse(lexiconVerseQueryKeyRequest),
    queryFn: async (): Promise<StrongVerseQueryData> => {
      const result = await resources.lexiconBible.loadVerseBase(lexiconVerseRequest)
      if (result.status !== 'available') {
        throw new StrongVerseQueryError(
          result.status === 'unavailable'
            ? 'STRONG_BIBLE_UNAVAILABLE'
            : result.status === 'missing-location'
              ? 'STRONG_VERSE_NOT_INDEXED'
              : 'UNKNOWN_ERROR'
        )
      }

      return toStrongVerseQueryData(result)
    },
    placeholderData: keepPreviousData,
    ...staticResourceQueryOptions,
    ...localQueryOptions,
  })
  const strongVerseBaseData = strongVerseQuery.data
  const strongVerseEnrichmentQuery = useQuery({
    queryKey: resourceQueryKeys.lexiconBibleVerseEnrichment(lexiconVerseQueryKeyRequest),
    queryFn: async () => {
      const result = await resources.lexiconBible.enrichVerse(
        lexiconVerseRequest,
        strongVerseBaseData!.sourceResult
      )
      return result.status === 'available' ? toStrongVerseQueryData(result) : strongVerseBaseData!
    },
    enabled:
      Boolean(strongVerseBaseData) &&
      !strongVerseQuery.isPlaceholderData &&
      strongVerseBaseData?.provenance?.versionId !== 'BHG',
    staleTime: Infinity,
    ...localQueryOptions,
  })
  const strongVerseData = strongVerseEnrichmentQuery.data ?? strongVerseBaseData
  const strongIdentityKeys = (strongVerseData?.strongIdentities ?? [])
    .map(identity => `${identity.kind}:${identity.code}`)
    .sort()
  const strongCardsQuery = useQuery({
    queryKey: resourceQueryKeys.strongLexiconEntryCards(strongResourceLanguage, strongIdentityKeys),
    queryFn: () =>
      resources.strongLexicon.loadEntryCards(
        strongVerseData?.strongIdentities ?? [],
        strongResourceLanguage
      ),
    enabled:
      Boolean(strongVerseData) &&
      !strongVerseQuery.isPlaceholderData &&
      strongIdentityKeys.length > 0,
    staleTime: Infinity,
    ...localQueryOptions,
  })
  const provenanceVersionId = strongVerseData?.provenance?.versionId
  const coverageQuery = useQuery({
    queryKey: resourceQueryKeys.bibleCoverage(provenanceVersionId ?? 'pending'),
    queryFn: () => resources.bibleContent.loadCoverage(provenanceVersionId!),
    enabled: Boolean(provenanceVersionId),
    ...staticResourceQueryOptions,
    ...localQueryOptions,
  })
  const strongCards = (strongVerseData?.strongOccurrences ?? []).flatMap(
    (occurrence, occurrenceIndex) => {
      const entry = strongCardsQuery.data?.find(candidate =>
        areStrongIdentitiesEqual(candidate.selectedIdentity, occurrence.identity)
      )
      if (!entry) return []

      return [
        {
          entry,
          occurrenceIndex,
          context: {
            bibleVersion: provenanceVersionId,
            ...(provenanceVersionId && provenanceVersionId !== 'BHG'
              ? { strongBibleVersionId: provenanceVersionId as StrongBibleVersionId }
              : {}),
            book: verseBook,
            bibleChapter: verseChapter,
            bibleVerse: verseNumber,
            ...(occurrence.clickedWord ? { clickedWord: occurrence.clickedWord } : {}),
            morphologyCodes: occurrence.morphologyCodes,
          },
        },
      ]
    }
  )

  const findRefIndex = (ref: string | number, occurrenceIndex: number) =>
    strongCards.findIndex(
      card =>
        card.occurrenceIndex === occurrenceIndex && Number(card.entry.baseCode) === Number(ref)
    )

  const scrollToStrongCard = (ref: string | number, occurrenceIndex: number) => {
    const index = findRefIndex(ref, occurrenceIndex)
    if (index !== -1) {
      isProgrammaticCardsScrollRef.current = true
      strongCardsScrollRef.current?.scrollToIndex({ index, animated: true })
      currentStrongCardIndexRef.current = index
      setCurrentStrongCardIndex(index)
    }
  }

  const registerStrongWordLayout = (occurrenceIndex: number, verseContentOffsetY: number) => {
    strongWordLayoutsRef.current.set(occurrenceIndex, verseContentOffsetY)
  }

  const scrollVerseToOccurrence = (occurrenceIndex: number) => {
    const y = strongWordLayoutsRef.current.get(occurrenceIndex)
    if (y === undefined) return

    verseScrollRef.current?.scrollTo({ y, animated: true })
  }

  const selectStrongCardFromOffset = (offsetX: number) => {
    if (isProgrammaticCardsScrollRef.current) return

    const index = Math.min(
      Math.max(0, Math.round(offsetX / carouselStep)),
      Math.max(0, strongCards.length - 1)
    )
    if (index === currentStrongCardIndexRef.current) return

    currentStrongCardIndexRef.current = index
    setCurrentStrongCardIndex(index)
    const occurrenceIndex = strongCards[index]?.occurrenceIndex
    if (occurrenceIndex !== undefined) scrollVerseToOccurrence(occurrenceIndex)
  }

  const renderStrongCard = ({ item, index }: { item: StrongCardItem; index: number }) => {
    return (
      <StrongCard
        theme={theme}
        isSelectionMode={isSelectionMode}
        book={String(strongVerseData?.displayedVerse?.Livre ?? verse.Livre)}
        strongEntry={item.entry}
        strongVerseContext={item.context}
        index={index}
      />
    )
  }

  useEffect(() => {
    if (!strongVerseBaseData || strongVerseQuery.isPlaceholderData) return
    hasDisplayedStrongVerseRef.current = true
    currentStrongCardIndexRef.current = 0
    isProgrammaticCardsScrollRef.current = false
    setCurrentStrongCardIndex(0)
    onStrongBibleProvenanceChange?.(strongVerseBaseData.provenance)
    verseScrollRef.current?.scrollTo({ y: 0, animated: false })
    strongCardsScrollRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [onStrongBibleProvenanceChange, strongVerseBaseData, strongVerseQuery.isPlaceholderData])

  useEffect(() => {
    if (
      !hasDisplayedStrongVerseRef.current &&
      strongVerseQuery.error instanceof StrongVerseQueryError &&
      strongVerseQuery.error.code === 'STRONG_BIBLE_UNAVAILABLE'
    ) {
      onStrongBibleProvenanceChange?.(null)
    }
  }, [onStrongBibleProvenanceChange, strongVerseQuery.error])

  const formattedTexte = strongVerseData?.formattedTexte ?? null
  const versesInCurrentChapter =
    getChapterVerseCountFromCoverage(coverageQuery.data, verseBook, verseChapter) ||
    countLsgChapters[`${verseBook}-${verseChapter}`]
  const error =
    !strongVerseData && strongVerseQuery.error instanceof StrongVerseQueryError
      ? strongVerseQuery.error.code
      : !strongVerseData && strongVerseQuery.isError
        ? 'UNKNOWN_ERROR'
        : false

  if (
    coreAvailabilityQuery.data &&
    coreAvailabilityQuery.data.availability.status !== 'available'
  ) {
    return (
      <ResourceUnavailableView
        identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
        title={t('resource.strong.offlineCopyNeeded')}
        offlineTitle={t('resource.strong.temporarilyUnavailable')}
        fileSize={35}
        size="small"
        mt={100}
        failure={resourceFailureFromStrongModuleAvailability(
          coreAvailabilityQuery.data.availability,
          coreAvailabilityQuery.data.recoveries
        )}
        onRetry={() => {
          void coreAvailabilityQuery.refetch()
          void strongVerseQuery.refetch()
        }}
      />
    )
  }

  if (error) {
    if (error === 'STRONG_VERSE_NOT_INDEXED') {
      return (
        <Container>
          <Empty
            iconElement={<FeatherIcon name="book-open" size={36} color="tertiary" />}
            message={t('resource.strong.noLexiconForVerse')}
          />
        </Container>
      )
    }

    if (error === 'STRONG_BIBLE_UNAVAILABLE') {
      return (
        <Container>
          <Empty
            iconElement={<FeatherIcon name="book-open" size={36} color="tertiary" />}
            message={t('strongSource.unavailableMessage')}
          >
            <Box className="overflow-hidden border-continuous mt-[24px] w-[260px]">
              <Button onPress={onOpenStrongBibleSourceSheet}>
                {t('strongSource.chooseAction')}
              </Button>
            </Box>
          </Empty>
        </Container>
      )
    }

    return (
      <ResourceUnavailableView
        identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
        title={t('resource.strong.temporarilyUnavailable')}
        fileSize={35}
        failure={resourceFailureFromAccessError(
          strongVerseQuery.error ?? coreAvailabilityQuery.error
        )}
        size="small"
        mt={100}
        onRetry={() => {
          void coreAvailabilityQuery.refetch()
          void strongVerseQuery.refetch()
        }}
      />
    )
  }

  if (!formattedTexte) {
    return <Loading />
  }

  const verseTextStyle = {
    fontSize: Number.parseFloat(getBibleTextFontSize(false, fontSizeScale)),
    lineHeight: Number.parseFloat(scaleLineHeight(24, lineHeightSetting, fontSizeScale)),
  }
  const verseMaxHeight = modalContentHeight ? modalContentHeight * 0.4 : undefined

  return (
    <Box
      className="overflow-hidden border-continuous flex-[1]"
      testID="resource-modal-content"
      onLayout={event => setModalContentHeight(event.nativeEvent.layout.height)}
    >
      <Box className="overflow-hidden border-continuous relative z-[1]">
        <ScrollView
          ref={verseScrollRef}
          testID="resource-verse-scroll"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={verseMaxHeight ? { maxHeight: verseMaxHeight } : undefined}
          contentContainerStyle={{
            paddingRight: 20,
            marginTop: 20,
          }}
        >
          <StyledVerse>
            <VersetWrapper>
              <NumberText>{strongVerseData?.displayedVerse?.Verset ?? verse.Verset}</NumberText>
            </VersetWrapper>
            <StrongResourceScrollProvider
              value={{
                currentTarget: strongCards[currentStrongCardIndex]
                  ? {
                      code: strongCards[currentStrongCardIndex].entry.baseCode,
                      occurrenceIndex: strongCards[currentStrongCardIndex]?.occurrenceIndex,
                    }
                  : null,
                registerStrongWordLayout,
                scrollToStrongCard,
              }}
            >
              <Box
                className="overflow-hidden border-continuous flex-[1] flex-row flex-wrap items-start"
                testID="resource-verse-text"
              >
                {React.cloneElement(formattedTexte, { textStyle: verseTextStyle })}
              </Box>
            </StrongResourceScrollProvider>
          </StyledVerse>
        </ScrollView>
        <BibleVerseDetailFooter
          verseNumber={verse.Verset}
          goToNextVerse={() => updateVerse(+1)}
          goToPrevVerse={() => updateVerse(-1)}
          versesInCurrentChapter={versesInCurrentChapter}
        />
      </Box>
      <Box className="overflow-hidden border-continuous bg-light-grey mt-[-30px] relative z-[0]">
        <RoundedCorner />
      </Box>
      <Box className="overflow-hidden border-continuous bg-light-grey flex-[1]">
        {strongCardsQuery.isError ? (
          <ResourceUnavailableView
            identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
            title={t('resource.strong.temporarilyUnavailable')}
            fileSize={35}
            failure={resourceFailureFromAccessError(strongCardsQuery.error)}
            size="small"
            onRetry={() => void strongCardsQuery.refetch()}
          />
        ) : strongCardsQuery.isPending && strongIdentityKeys.length > 0 ? (
          <Loading />
        ) : (
          <FlatList
            ref={strongCardsScrollRef}
            data={strongCards}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={carouselStep}
            snapToAlignment="start"
            decelerationRate="fast"
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={3}
            keyExtractor={item =>
              `${item.entry.selectedIdentity.kind}:${item.entry.selectedIdentity.code}:${item.occurrenceIndex}`
            }
            getItemLayout={(_, index) => ({
              length: carouselStep,
              offset: carouselStep * index,
              index,
            })}
            ItemSeparatorComponent={() => (
              <Box className="overflow-hidden border-continuous" style={{ width: itemGap }} />
            )}
            renderItem={({ item, index }) => (
              <Box className="overflow-hidden border-continuous" style={{ width: itemWidth }}>
                {renderStrongCard({ item, index })}
              </Box>
            )}
            onScrollBeginDrag={() => {
              isProgrammaticCardsScrollRef.current = false
            }}
            onMomentumScrollEnd={() => {
              isProgrammaticCardsScrollRef.current = false
            }}
            onScroll={event => selectStrongCardFromOffset(event.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingLeft: 20,
              paddingRight: 20,
              paddingBottom: insets.bottom + 180,
            }}
          />
        )}
      </Box>
    </Box>
  )
}

export default BibleVerseDetailCard
