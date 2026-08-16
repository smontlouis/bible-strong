import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import React, { useEffect, useRef, useState } from 'react'

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

import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { StudyNavigateBibleType } from '~common/types'
import Button from '~common/ui/Button'
import type { LexiconBibleProvenance } from '~features/resources/lexiconBibleResourceAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import { getChapterVerseCountFromCoverage } from '~helpers/bibleCoverage'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { localQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import {
  getStrongBibleFallbackPriority,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import { areStrongIdentitiesEqual } from '~helpers/strongIdentities'
import { wp } from '~helpers/utils'
import type { RootState } from '~redux/modules/reducer'
import { useResourcesLanguageValue } from '~state/resourcesLanguage'
import type { VersionCode } from '~state/tabs'
import { scaleFontSize } from './BibleDOM/scaleFontSize'
import { scaleLineHeight } from './BibleDOM/scaleLineHeight'
import { getStrongWordOccurrences, type StrongVerseContext } from './strongResourceCardContext'
import { StrongResourceScrollProvider } from './StrongResourceScrollContext'
import OfflineResourceRecovery from '~features/resources/OfflineResourceRecovery'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth + itemHorizontalMargin * 2

const VerseText = styled.View(() => ({
  flexWrap: 'nowrap',
  alignItems: 'flex-start',
  flexDirection: 'row',
}))

const VersetWrapper = styled.View(() => ({
  width: 25,
  marginRight: 5,
  borderRightWidth: 3,
  borderRightColor: 'transparent',
  alignItems: 'flex-end',
}))

const NumberText = styled(Paragraph)({
  marginTop: 0,
  fontSize: 9,
  justifyContent: 'flex-end',
  marginRight: 3,
})

const StyledVerse = styled.View(() => ({
  paddingLeft: 0,
  paddingRight: 10,
  marginBottom: 5,
  flexDirection: 'row',
}))

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

class StrongVerseQueryError extends Error {
  code: StrongVerseQueryErrorCode

  constructor(code: StrongVerseQueryErrorCode) {
    super(code)
    this.name = 'StrongVerseQueryError'
    this.code = code
  }
}

interface StrongCardItem {
  entry: StrongLexiconEntry
  context: StrongVerseContext
  occurrenceIndex: number
}

interface StrongVerseQueryData {
  strongCards: StrongCardItem[]
  versesInCurrentChapter: number | null
  formattedTexte: React.ReactElement<React.ComponentProps<typeof CanonicalStrongVerseText>> | null
  provenance: LexiconBibleProvenance | null
  displayedVerse: Verse | null
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
  const router = useRouter()
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
  const strongCardsScrollRef = useRef<ScrollView>(null)
  const strongWordLayoutsRef = useRef(new Map<number, number>())
  const currentStrongCardIndexRef = useRef(0)
  const isProgrammaticCardsScrollRef = useRef(false)
  const hasDisplayedStrongVerseRef = useRef(false)
  const insets = useSafeAreaInsets()
  const [currentStrongCardIndex, setCurrentStrongCardIndex] = useState(0)
  const coreAvailabilityQuery = useQuery({
    queryKey: resourceQueryKeys.strongLexiconAvailability('core'),
    queryFn: async () => ({
      availability: await resources.strongLexicon.getModuleAvailability('core'),
      recoveries: await resources.strongLexicon.getModuleRecoveryActions?.('core'),
    }),
    networkMode: 'always',
    staleTime: Infinity,
  })

  const strongVerseQuery = useQuery({
    queryKey: resourceQueryKeys.lexiconBibleVerse({
      currentVersionId: selectedVersion,
      defaultVersionId: defaultStrongVersion,
      preferredInterlinearLocale,
      preferredVersionId: preferredStrongVersionId,
      resourceLanguage: strongResourceLanguage,
      book: verseBook,
      chapter: verseChapter,
      verse: verseNumber,
    }),
    queryFn: async (): Promise<StrongVerseQueryData> => {
      const result = await resources.lexiconBible.loadVerse({
        currentVersionId: selectedVersion,
        defaultVersionId: defaultStrongVersion,
        preferredVersionId: preferredStrongVersionId,
        preferredInterlinearLocale,
        fallbackVersionIds: getStrongBibleFallbackPriority(selectedVersion),
        book: verseBook,
        chapter: verseChapter,
        verse: verseNumber,
      })
      if (result.status !== 'available') {
        throw new StrongVerseQueryError(
          result.status === 'unavailable' ? 'STRONG_BIBLE_UNAVAILABLE' : 'UNKNOWN_ERROR'
        )
      }

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
      const [coverage, strongReferencesResult] = await Promise.all([
        resources.bibleContent.loadCoverage(result.provenance.versionId),
        resources.strongLexicon.loadEntries(strongIdentities, strongResourceLanguage),
      ])
      const versesInCurrentChapterResult =
        getChapterVerseCountFromCoverage(coverage, verseBook, verseChapter) ?? 0
      const strongCards = strongOccurrences.flatMap((occurrence, occurrenceIndex) => {
        const entry = strongReferencesResult.find(candidate =>
          areStrongIdentitiesEqual(candidate.selectedIdentity, occurrence.identity)
        )
        if (!entry) return []

        return [
          {
            entry,
            occurrenceIndex,
            context: {
              bibleVersion: result.provenance.versionId,
              ...(result.provenance.versionId === 'BHG'
                ? {}
                : { strongBibleVersionId: result.provenance.versionId }),
              book: verseBook,
              bibleChapter: verseChapter,
              bibleVerse: verseNumber,
              ...(occurrence.clickedWord ? { clickedWord: occurrence.clickedWord } : {}),
              morphologyCodes: occurrence.morphologyCodes,
            },
          },
        ]
      })
      const formattedTexte = (
        <CanonicalStrongVerseText verse={{ ...strongVerse, Livre: verseBook }} />
      )

      return {
        formattedTexte,
        strongCards,
        versesInCurrentChapter:
          versesInCurrentChapterResult || countLsgChapters[`${verseBook}-${verseChapter}`],
        provenance: result.provenance,
        displayedVerse: {
          Livre: verseBook,
          Chapitre: verseChapter,
          Verset: verseNumber,
        },
      }
    },
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    ...localQueryOptions,
  })
  const strongVerseData = strongVerseQuery.data
  const strongCards = strongVerseData?.strongCards ?? []

  const findRefIndex = (ref: string | number, occurrenceIndex: number) =>
    strongCards.findIndex(
      card =>
        card.occurrenceIndex === occurrenceIndex && Number(card.entry.baseCode) === Number(ref)
    )

  const scrollToStrongCard = (ref: string | number, occurrenceIndex: number) => {
    const index = findRefIndex(ref, occurrenceIndex)
    if (index !== -1) {
      isProgrammaticCardsScrollRef.current = true
      strongCardsScrollRef.current?.scrollTo({ x: index * itemWidth, animated: true })
      currentStrongCardIndexRef.current = index
      setCurrentStrongCardIndex(index)
    }
  }

  const registerStrongWordLayout = (occurrenceIndex: number, verseContentOffsetX: number) => {
    strongWordLayoutsRef.current.set(occurrenceIndex, verseContentOffsetX)
  }

  const scrollVerseToOccurrence = (occurrenceIndex: number) => {
    const x = strongWordLayoutsRef.current.get(occurrenceIndex)
    if (x === undefined) return

    verseScrollRef.current?.scrollTo({ x, animated: true })
  }

  const selectStrongCardFromOffset = (offsetX: number) => {
    if (isProgrammaticCardsScrollRef.current) return

    const index = Math.min(
      Math.max(0, Math.round(offsetX / itemWidth)),
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
    if (!strongVerseData || strongVerseQuery.isPlaceholderData) return
    hasDisplayedStrongVerseRef.current = true
    currentStrongCardIndexRef.current = 0
    isProgrammaticCardsScrollRef.current = false
    setCurrentStrongCardIndex(0)
    onStrongBibleProvenanceChange?.(strongVerseData.provenance)
    verseScrollRef.current?.scrollTo({ x: 0, animated: false })
    strongCardsScrollRef.current?.scrollTo({ x: 0, animated: false })
  }, [onStrongBibleProvenanceChange, strongVerseData, strongVerseQuery.isPlaceholderData])

  useEffect(() => {
    if (
      !hasDisplayedStrongVerseRef.current &&
      strongVerseQuery.error instanceof StrongVerseQueryError &&
      strongVerseQuery.error.code === 'STRONG_BIBLE_UNAVAILABLE'
    ) {
      onStrongBibleProvenanceChange?.(null)
    }
  }, [onStrongBibleProvenanceChange, strongVerseQuery.error])

  const { versesInCurrentChapter, formattedTexte } = strongVerseData ?? {
    versesInCurrentChapter: null,
    formattedTexte: null,
  }
  const error =
    !strongVerseData && strongVerseQuery.error instanceof StrongVerseQueryError
      ? strongVerseQuery.error.code
      : !strongVerseData && strongVerseQuery.isError
        ? 'UNKNOWN_ERROR'
        : false

  if (
    coreAvailabilityQuery.data?.availability.status !== 'available' &&
    coreAvailabilityQuery.data?.recoveries?.includes('acquire-offline-copy')
  ) {
    return (
      <OfflineResourceRecovery
        identity={{ kind: 'strong-lexicon-module', moduleId: 'core' }}
        title={t('resource.strong.offlineCopyNeeded')}
        fileSize={35}
        size="small"
      />
    )
  }

  if (error) {
    if (error === 'STRONG_BIBLE_UNAVAILABLE') {
      return (
        <Container>
          <Empty
            iconElement={<FeatherIcon name="book-open" size={36} color="tertiary" />}
            message={t('strongSource.unavailableMessage')}
          >
            <Box mt={24} width={260}>
              <Button onPress={onOpenStrongBibleSourceSheet}>
                {t('strongSource.chooseAction')}
              </Button>
            </Box>
          </Empty>
        </Container>
      )
    }

    return (
      <Container>
        <Empty
          source={require('~assets/images/empty.json')}
          message={`Impossible de charger la strong pour ce verset...${
            error === 'CORRUPTED_DATABASE'
              ? t(
                  '\n\nVotre base de données semble être corrompue. Rendez-vous dans la gestion de téléchargements pour retélécharger la base de données.'
                )
              : ''
          }`}
        />
        <Box px={30} pb={30}>
          <Button onPress={() => router.push('/downloads')}>
            {t('Gérer les téléchargements Strong')}
          </Button>
        </Box>
      </Container>
    )
  }

  if (!formattedTexte) {
    return <Loading />
  }

  const verseTextStyle = {
    fontSize: Number.parseFloat(scaleFontSize(24, fontSizeScale)),
    lineHeight: Number.parseFloat(scaleLineHeight(30, lineHeightSetting, fontSizeScale)),
  }

  return (
    <Box flex={1}>
      <Box position="relative" zIndex={1}>
        <ScrollView
          ref={verseScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 10,
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
              <VerseText>
                {React.cloneElement(formattedTexte, { textStyle: verseTextStyle })}
              </VerseText>
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
      <Box bg="lightGrey" mt={-30} position="relative" zIndex={0}>
        <RoundedCorner />
      </Box>
      <Box bg="lightGrey" flex={1}>
        <ScrollView
          ref={strongCardsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={itemWidth}
          snapToAlignment="start"
          decelerationRate="fast"
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
            gap: 10,
          }}
        >
          {strongCards.map((item, index) => (
            <Box
              key={`${item.entry.selectedIdentity.kind}:${item.entry.selectedIdentity.code}:${item.occurrenceIndex}`}
              width={itemWidth}
            >
              {renderStrongCard({ item, index })}
            </Box>
          ))}
        </ScrollView>
      </Box>
    </Box>
  )
}

export default BibleVerseDetailCard
