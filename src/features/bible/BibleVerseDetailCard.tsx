import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import React, { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'

import waitForStrongDB from '~common/waitForStrongDB'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import RoundedCorner from '~common/ui/RoundedCorner'
import StrongCard from './StrongCard'
import CanonicalStrongVerseText from './CanonicalStrongVerseText'

import BibleVerseDetailFooter from './BibleVerseDetailFooter'

import { useTranslation } from 'react-i18next'
import { useAtomValue } from 'jotai/react'
import { ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useSelector } from 'react-redux'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { StudyNavigateBibleType } from '~common/types'
import { CarouselProvider } from '~helpers/CarouselContext'
import { getChapterVerseCountSafe } from '~helpers/bibleCoverage'
import { useLayoutSize } from '~helpers/useLayoutSize'
import { wp } from '~helpers/utils'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { LexiconBibleProvenance } from '~features/resources/lexiconBibleResourceAccess'
import type { RootState } from '~redux/modules/reducer'
import Button from '~common/ui/Button'
import type { VersionCode } from '~state/tabs'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import {
  getStrongBibleFallbackPriority,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import { localQueryOptions } from '~helpers/queryOptions'
import { scaleFontSize } from './BibleDOM/scaleFontSize'
import { scaleLineHeight } from './BibleDOM/scaleLineHeight'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import { getDisplayedStrongIdentities } from '~helpers/strongIdentities'
import { useResourcesLanguageValue } from '~state/resourcesLanguage'

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

interface StrongVerseQueryData {
  strongReferences: StrongLexiconEntry[]
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
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const strongResourceLanguage = useResourcesLanguageValue().STRONG
  const verseBook = verse.Livre
  const verseChapter = verse.Chapitre
  const verseNumber = verse.Verset
  const carouselRef = useRef<ICarouselInstance>(null)
  const hasDisplayedStrongVerseRef = useRef(false)
  const [boxHeight, setBoxHeight] = useState(0)
  const {
    ref: carouselContainerRef,
    size: carouselContainerSize,
    onLayout: onCarouselContainerLayout,
  } = useLayoutSize()
  const [currentStrongReference, setCurrentStrongReference] = useState<StrongLexiconEntry | null>(
    null
  )

  const strongVerseQuery = useQuery({
    queryKey: [
      'strong-verse-detail',
      selectedVersion,
      defaultStrongVersion,
      preferredStrongVersionId,
      preferredInterlinearLocale,
      verseBook,
      verseChapter,
      verseNumber,
      strongResourceLanguage,
      downloadCompletionSignal,
    ],
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
      const strongIdentities = [
        ...new Map(
          (strongVerse.StrongSpans ?? [])
            .flatMap(span => getDisplayedStrongIdentities(span.identities))
            .map(identity => [`${identity.kind}:${identity.code}`, identity])
        ).values(),
      ]
      const [versesInCurrentChapterResult, strongReferencesResult] = await Promise.all([
        getChapterVerseCountSafe(result.provenance.versionId, verseBook, verseChapter),
        resources.strongLexicon.loadEntries(strongIdentities, strongResourceLanguage),
      ])
      const strongReferences = strongReferencesResult
      const formattedTexte = (
        <CanonicalStrongVerseText verse={{ ...strongVerse, Livre: verseBook }} />
      )

      return {
        formattedTexte,
        strongReferences,
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
  const strongReferences = strongVerseData?.strongReferences ?? []

  const findRefIndex = (ref: string | number) =>
    strongReferences.findIndex(r => Number(r.baseCode) === Number(ref))

  const goToCarouselItem = (ref: string | number) => {
    const index = findRefIndex(ref)
    if (index !== -1) {
      carouselRef.current?.scrollTo({ index, animated: true })
    }
    setCurrentStrongReference(
      strongReferences.find(reference => Number(reference.baseCode) === Number(ref)) || null
    )
  }

  const onSnapToItem = (index: number) => {
    setCurrentStrongReference(strongReferences[index] || null)
  }

  const renderItem = ({ item, index }: { item: StrongLexiconEntry; index: number }) => {
    return (
      <StrongCard
        theme={theme}
        isSelectionMode={isSelectionMode}
        book={String(strongVerseData?.displayedVerse?.Livre ?? verse.Livre)}
        strongEntry={item}
        strongBibleVersionId={
          strongVerseData?.provenance?.versionId === 'BHG'
            ? undefined
            : strongVerseData?.provenance?.versionId
        }
        index={index}
      />
    )
  }

  useEffect(() => {
    if (!strongVerseData || strongVerseQuery.isPlaceholderData) return
    hasDisplayedStrongVerseRef.current = true
    setCurrentStrongReference(strongVerseData.strongReferences[0] || null)
    onStrongBibleProvenanceChange?.(strongVerseData.provenance)
    carouselRef.current?.scrollTo({ index: 0, animated: false })
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

  const currentStrongReferenceIndex = strongReferences.findIndex(
    r => Number(r.baseCode) === Number(currentStrongReference?.baseCode)
  )
  const verseTextStyle = {
    fontSize: Number.parseFloat(scaleFontSize(24, fontSizeScale)),
    lineHeight: Number.parseFloat(scaleLineHeight(24, lineHeightSetting, fontSizeScale)),
  }

  return (
    <Box flex={1} onLayout={e => setBoxHeight(e.nativeEvent.layout.height)}>
      <Box maxHeight={boxHeight / 2} position="relative" zIndex={1}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 10, paddingRight: 20 }}
        >
          <StyledVerse>
            <VersetWrapper>
              <NumberText>{strongVerseData?.displayedVerse?.Verset ?? verse.Verset}</NumberText>
            </VersetWrapper>
            <CarouselProvider
              value={{
                currentStrongReference: currentStrongReference
                  ? { Code: currentStrongReference.baseCode }
                  : null,
                goToCarouselItem,
              }}
            >
              <VerseText>
                {React.cloneElement(formattedTexte, { textStyle: verseTextStyle })}
              </VerseText>
            </CarouselProvider>
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
      <Box ref={carouselContainerRef} bg="lightGrey" flex={1} onLayout={onCarouselContainerLayout}>
        <Carousel
          ref={carouselRef}
          mode="horizontal-stack"
          scrollAnimationDuration={300}
          itemWidth={itemWidth}
          itemHeight={carouselContainerSize.height}
          onConfigurePanGesture={gestureChain => {
            gestureChain.activeOffsetX([-10, 10])
          }}
          modeConfig={{
            opacityInterval: 0.8,
            scaleInterval: 0,
            stackInterval: itemWidth,
            rotateZDeg: 0,
          }}
          style={{
            paddingLeft: 20,
            overflow: 'visible',
            flex: 1,
            width: '100%',
          }}
          data={strongReferences}
          renderItem={renderItem}
          onSnapToItem={onSnapToItem}
          defaultIndex={currentStrongReferenceIndex === -1 ? 0 : currentStrongReferenceIndex}
        />
      </Box>
    </Box>
  )
}

export default waitForStrongDB()(BibleVerseDetailCard)
