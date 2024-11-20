import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import React, { useEffect, useRef, useState } from 'react'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import DictionnaryIcon from '~common/DictionnaryIcon'
import Link from '~common/Link'
import waitForStrongDB from '~common/waitForStrongDB'
import loadStrongReferences from '~helpers/loadStrongReferences'
import loadStrongVerse from '~helpers/loadStrongVerse'
import verseToStrong from '~helpers/verseToStrong'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import RoundedCorner from '~common/ui/RoundedCorner'
import StrongCard from './StrongCard'

import BibleVerseDetailFooter from './BibleVerseDetailFooter'

import { withTranslation } from 'react-i18next'
import { withSafeAreaInsets } from 'react-native-safe-area-context'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { CarouselProvider } from '~helpers/CarouselContext'
import formatVerseContent from '~helpers/formatVerseContent'
import { viewportWidth, hp, wp } from '~helpers/utils'
import { StackScreenProps } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const sliderWidth = viewportWidth
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

interface BibleVerseDetailScreenProps
  extends StackScreenProps<MainStackProps, 'BibleVerseDetail'> {
  verse: {
    Livre: string
    Chapitre: number
    Verset: number
  }
}

interface StrongReference {
  Code: number
  // add other properties as needed
}

const BibleVerseDetailScreen: React.FC<BibleVerseDetailScreenProps> = ({
  navigation,
  route,
  verse: initialVerse,
}) => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const carouselRef = useRef<ICarouselInstance | null>(null)

  const [state, setState] = useState({
    error: false,
    isCarouselLoading: true,
    strongReferences: [] as StrongReference[],
    currentStrongReference: null as StrongReference | null | undefined,
    verse: initialVerse,
    versesInCurrentChapter: null as number | null,
    formattedTexte: '',
  })

  useEffect(() => {
    loadPage()
  }, [state.verse.Verset])

  const updateVerse = (value: number) => {
    setState(prev => ({
      ...prev,
      verse: {
        ...prev.verse,
        Verset: Number(prev.verse.Verset) + value,
      },
    }))
  }

  const loadPage = async () => {
    const { verse } = state
    const strongVerse = await loadStrongVerse(verse)

    if (!strongVerse) {
      setState(prev => ({ ...prev, error: true }))
      return
    }

    const versesInCurrentChapter =
      countLsgChapters[`${verse.Livre}-${verse.Chapitre}`]

    setState(prev => ({ ...prev, versesInCurrentChapter }))
    formatVerse(strongVerse)
  }

  const formatVerse = async (strongVerse: any) => {
    const { formattedTexte, references } = await verseToStrong(strongVerse)

    setState(prev => ({ ...prev, formattedTexte }))

    const strongReferences = await loadStrongReferences(
      references,
      initialVerse.Livre
    )
    setState(prev => ({
      ...prev,
      isCarouselLoading: false,
      strongReferences,
      currentStrongReference: strongReferences[0],
    }))

    if (carouselRef.current) {
      carouselRef.current.scrollTo({ index: 0, animated: false })
    }
  }

  const findRefIndex = (ref: string) =>
    state.strongReferences.findIndex(r => r.Code === Number(ref))

  const goToCarouselItem = (ref: string) => {
    setState(prev => ({
      ...prev,
      currentStrongReference: state.strongReferences.find(
        r => r.Code === Number(ref)
      ),
    }))
  }

  const onSnapToItem = (index: number) => {
    setState(prev => ({
      ...prev,
      currentStrongReference: state.strongReferences[index],
    }))
  }

  const renderItem = ({
    item,
    index,
  }: {
    item: StrongReference
    index: number
  }) => {
    const { isSelectionMode } = route.params || {}
    return (
      <StrongCard
        theme={theme}
        isSelectionMode={isSelectionMode}
        navigation={navigation}
        book={state.verse.Livre}
        strongReference={item}
        index={index}
      />
    )
  }

  if (state.error) {
    return (
      <Container>
        <Header hasBackButton title={t('Désolé...')} />
        <Empty
          source={require('~assets/images/empty.json')}
          message={t('Impossible de charger la strong pour ce verset...')}
        />
      </Container>
    )
  }

  if (!state.formattedTexte) {
    return <Loading />
  }

  const { title: headerTitle } = formatVerseContent([state.verse])

  return (
    <StyledScrollView
      contentContainerStyle={{ paddingBottom: 20, minHeight: hp(75) }}
      scrollIndicatorInsets={{ right: 1 }}
    >
      <Box background paddingTop={insets.top} />
      <Header
        fontSize={18}
        hasBackButton
        title={`${headerTitle} ${
          headerTitle.length < 12 ? t('- Strong LSG') : ''
        }`}
        rightComponent={
          <Link
            route="DictionnaireVerseDetail"
            params={{ verse: state.verse }}
            replace
            padding
          >
            <Box position="relative" overflow="visible">
              <DictionnaryIcon color={theme.colors.secondary} />
            </Box>
          </Link>
        }
      />
      <Box>
        <Box background paddingTop={10}>
          <StyledVerse>
            <VersetWrapper>
              <NumberText>{state.verse.Verset}</NumberText>
            </VersetWrapper>
            <CarouselProvider
              value={{
                currentStrongReference: state.currentStrongReference,
                goToCarouselItem: goToCarouselItem,
              }}
            >
              <VerseText>{state.formattedTexte}</VerseText>
            </CarouselProvider>
          </StyledVerse>
          <BibleVerseDetailFooter
            {...{
              verseNumber: state.verse.Verset,
              goToNextVerse: () => {
                updateVerse(+1)
                setState(prev => ({ ...prev, isCarouselLoading: true }))
              },
              goToPrevVerse: () => {
                updateVerse(-1)
                setState(prev => ({ ...prev, isCarouselLoading: true }))
              },
              versesInCurrentChapter: state.versesInCurrentChapter,
            }}
          />
        </Box>
        <Box bg="lightGrey">
          <RoundedCorner />
        </Box>
        <Box bg="lightGrey">
          {state.isCarouselLoading && <Loading />}
          {!state.isCarouselLoading && (
            <Carousel
              ref={c => {
                carouselRef.current = c
              }}
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
                marginTop: 15,
                paddingLeft: 20,
                overflow: 'visible',
                flex: 1,
              }}
              data={state.strongReferences}
              renderItem={renderItem}
              onSnapToItem={onSnapToItem}
              defaultIndex={state.strongReferences.findIndex(
                r => r.Code === state.currentStrongReference.Code
              )}
            />
          )}
        </Box>
      </Box>
    </StyledScrollView>
  )
}

export default waitForStrongDB({
  hasBackButton: true,
  hasHeader: true,
})(BibleVerseDetailScreen)
