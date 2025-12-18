import styled from '@emotion/native'
import { useTheme, withTheme } from '@emotion/react'
import React, { useRef, useState, useEffect } from 'react'
import Carousel from 'react-native-reanimated-carousel'

import waitForStrongDB from '~common/waitForStrongDB'
import loadStrongReferences from '~helpers/loadStrongReferences'
import loadStrongVerse from '~helpers/loadStrongVerse'
import verseToStrong from '~helpers/verseToStrong'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import RoundedCorner from '~common/ui/RoundedCorner'
import StrongCard from './StrongCard'

import BibleVerseDetailFooter from './BibleVerseDetailFooter'

import { useTranslation, withTranslation } from 'react-i18next'
// import { withNavigation } from 'react-navigation'
import { useNavigation } from '@react-navigation/native'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { CarouselProvider } from '~helpers/CarouselContext'
import { hp, wp } from '~helpers/utils'
import { ScrollView, View } from 'react-native'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { StudyNavigateBibleType } from '~common/types'

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

const CountChip = styled.View(({ theme }) => ({
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: theme.colors.border,
  position: 'absolute',
  justifyContent: 'center',
  alignItems: 'center',
  bottom: -5,
  right: -5,
}))

const StyledScrollView = styled.ScrollView(({ theme }) => ({
  backgroundColor: theme.colors.lightGrey,
}))

interface StrongReference {
  Code: number
  // Add other properties as needed
}

interface Verse {
  Livre: string
  Chapitre: number
  Verset: number
  // Add other properties as needed
}

interface Props {
  verse: Verse
  isSelectionMode?: StudyNavigateBibleType
  updateVerse: (direction: number) => void
}

interface State {
  error: boolean | 'CORRUPTED_DATABASE'
  isCarouselLoading: boolean
  strongReferences: StrongReference[]
  currentStrongReference: StrongReference | null
  versesInCurrentChapter: number | null
  formattedTexte: React.ReactNode | null
}

const BibleVerseDetailCard: React.FC<Props> = ({ verse, isSelectionMode, updateVerse }) => {
  const navigation = useNavigation()
  const theme = useTheme()
  const { t } = useTranslation()
  const carouselRef = useRef<any>(null)
  const [boxHeight, setBoxHeight] = useState(0)
  const [state, setState] = useState<State>({
    error: false,
    isCarouselLoading: true,
    strongReferences: [],
    currentStrongReference: null,
    versesInCurrentChapter: null,
    formattedTexte: null,
  })

  const loadPage = async () => {
    const strongVerse = await loadStrongVerse(verse)

    if (!strongVerse) {
      setState(prev => ({ ...prev, error: true }))
      return
    }

    const versesInCurrentChapter = countLsgChapters[`${verse.Livre}-${verse.Chapitre}`]

    setState(prev => ({ ...prev, versesInCurrentChapter }))
    formatVerse(strongVerse)
  }

  const formatVerse = async (strongVerse: any) => {
    const { formattedTexte, references } = await verseToStrong(strongVerse)

    setState(prev => ({ ...prev, formattedTexte }))

    const strongReferences = await loadStrongReferences(references, verse.Livre)
    setState(prev => ({
      ...prev,
      isCarouselLoading: false,
      strongReferences,
      currentStrongReference: strongReferences[0],
    }))

    carouselRef.current?.scrollTo({ index: 0, animated: false })
  }

  const findRefIndex = (ref: string | number) =>
    state.strongReferences.findIndex(r => r.Code === Number(ref))

  const goToCarouselItem = (ref: string | number) => {
    setState(prev => ({
      ...prev,
      currentStrongReference: state.strongReferences.find(r => r.Code === Number(ref)) || null,
    }))
  }

  const onSnapToItem = (index: number) => {
    setState(prev => ({
      ...prev,
      currentStrongReference: state.strongReferences[index],
    }))
  }

  const renderItem = ({ item, index }: { item: StrongReference; index: number }) => {
    return (
      <StrongCard
        theme={theme}
        // @ts-ignore
        isSelectionMode={isSelectionMode}
        // @ts-ignore
        navigation={navigation}
        // @ts-ignore
        book={verse.Livre}
        // @ts-ignore
        strongReference={item}
        index={index}
      />
    )
  }

  useEffect(() => {
    loadPage()
  }, [verse.Verset])

  const { isCarouselLoading, versesInCurrentChapter, error, formattedTexte } = state

  if (error) {
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
      </Container>
    )
  }

  if (!formattedTexte) {
    return <Loading />
  }

  const currentStrongReferenceIndex = state.strongReferences.findIndex(
    r => r?.Code === state.currentStrongReference?.Code
  )

  return (
    <Box flex={1} onLayout={e => setBoxHeight(e.nativeEvent.layout.height)}>
      <Box maxHeight={boxHeight / 2} position="relative" zIndex={1}>
        <BottomSheetScrollView contentContainerStyle={{ paddingTop: 10 }}>
          <StyledVerse>
            <VersetWrapper>
              <NumberText>{verse.Verset}</NumberText>
            </VersetWrapper>
            <CarouselProvider
              value={{
                currentStrongReference: state.currentStrongReference,
                goToCarouselItem,
              }}
            >
              <VerseText>{formattedTexte}</VerseText>
            </CarouselProvider>
          </StyledVerse>
        </BottomSheetScrollView>
        <BibleVerseDetailFooter
          verseNumber={verse.Verset}
          goToNextVerse={() => {
            updateVerse(+1)
            setState(prev => ({ ...prev, isCarouselLoading: true }))
          }}
          goToPrevVerse={() => {
            updateVerse(-1)
            setState(prev => ({ ...prev, isCarouselLoading: true }))
          }}
          versesInCurrentChapter={versesInCurrentChapter}
        />
      </Box>
      <Box bg="lightGrey" mt={-30} position="relative" zIndex={0}>
        <RoundedCorner />
      </Box>
      <Box bg="lightGrey" flex={1}>
        {isCarouselLoading && <Loading />}
        {!isCarouselLoading && (
          <Carousel
            ref={carouselRef}
            mode="horizontal-stack"
            scrollAnimationDuration={300}
            width={itemWidth}
            panGestureHandlerProps={{
              activeOffsetX: [-10, 10],
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
            }}
            data={state.strongReferences}
            renderItem={renderItem}
            onSnapToItem={onSnapToItem}
            defaultIndex={currentStrongReferenceIndex === -1 ? 0 : currentStrongReferenceIndex}
          />
        )}
      </Box>
    </Box>
  )
}

export default waitForStrongDB()(BibleVerseDetailCard)
