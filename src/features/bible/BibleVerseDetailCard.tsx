import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import React, { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'

import waitForStrongDB from '~common/waitForStrongDB'
import verseToStrong from '~helpers/verseToStrong'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import RoundedCorner from '~common/ui/RoundedCorner'
import StrongCard from './StrongCard'

import BibleVerseDetailFooter from './BibleVerseDetailFooter'

import { useTranslation } from 'react-i18next'
import { useAtomValue } from 'jotai/react'
import { ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useSelector } from 'react-redux'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { StrongReference, StudyNavigateBibleType } from '~common/types'
import { CarouselProvider } from '~helpers/CarouselContext'
import { getChapterVerseCountSafe } from '~helpers/bibleCoverage'
import { parseStrongVerse } from '~helpers/strongVerseParser'
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
import { isDatabaseError } from '~helpers/queryResult'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth + itemHorizontalMargin * 2

const VerseText = styled.View(() => ({
  flex: 1,
  flexWrap: 'wrap',
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

const StyledVerse = styled.View(({ theme }) => ({
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
  strongReferences: StrongReference[]
  versesInCurrentChapter: number | null
  formattedTexte: React.ReactNode | null
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
  const resources = useResourceAccess()
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
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
  const [currentStrongReference, setCurrentStrongReference] = useState<StrongReference | null>(null)

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
      const parsedVerse = parseStrongVerse(strongVerse.Texte, verseBook)
      const [versesInCurrentChapterResult, strongReferencesResult] = await Promise.all([
        getChapterVerseCountSafe(result.provenance.versionId, verseBook, verseChapter),
        resources.strong.loadReferences(parsedVerse.references, verseBook),
      ])
      if (isDatabaseError(strongReferencesResult)) {
        throw new StrongVerseQueryError(strongReferencesResult.error)
      }

      const strongReferences = strongReferencesResult.filter(
        (reference): reference is StrongReference => typeof reference !== 'string'
      )
      const { formattedTexte } = await verseToStrong(
        { ...strongVerse, Livre: verseBook },
        undefined,
        undefined,
        strongReferences
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
    strongReferences.findIndex(r => Number(r.Code) === Number(ref))

  const goToCarouselItem = (ref: string | number) => {
    const index = findRefIndex(ref)
    if (index !== -1) {
      carouselRef.current?.scrollTo({ index, animated: true })
    }
    setCurrentStrongReference(
      strongReferences.find(reference => Number(reference.Code) === Number(ref)) || null
    )
  }

  const onSnapToItem = (index: number) => {
    setCurrentStrongReference(strongReferences[index] || null)
  }

  const renderItem = ({ item, index }: { item: StrongReference; index: number }) => {
    return (
      <StrongCard
        theme={theme}
        isSelectionMode={isSelectionMode}
        book={String(strongVerseData?.displayedVerse?.Livre ?? verse.Livre)}
        strongReference={item}
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
    r => Number(r?.Code) === Number(currentStrongReference?.Code)
  )

  return (
    <Box flex={1} onLayout={e => setBoxHeight(e.nativeEvent.layout.height)}>
      <Box maxHeight={boxHeight / 2} position="relative" zIndex={1}>
        <ScrollView contentContainerStyle={{ paddingTop: 10 }}>
          <StyledVerse>
            <VersetWrapper>
              <NumberText>{strongVerseData?.displayedVerse?.Verset ?? verse.Verset}</NumberText>
            </VersetWrapper>
            <CarouselProvider
              value={{
                currentStrongReference,
                goToCarouselItem,
              }}
            >
              <VerseText>{formattedTexte}</VerseText>
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
