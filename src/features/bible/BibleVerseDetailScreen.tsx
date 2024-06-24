import styled from '@emotion/native'
import { useTheme, withTheme } from '@emotion/react'
import React, { useEffect, useState } from 'react'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'
import { connect } from 'react-redux'
import compose from 'recompose/compose'
import { StackScreenProps } from '@react-navigation/stack'

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

import { useTranslation, withTranslation } from 'react-i18next'
import { withSafeAreaInsets } from 'react-native-safe-area-context'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { CarouselProvider } from '~helpers/CarouselContext'
import formatVerseContent from '~helpers/formatVerseContent'
import { viewportWidth, hp, wp } from '~helpers/utils'
import { MainStackProps } from '~navigation/type'
import { StrongReference } from '~common/types'
import { CarouselRenderItem } from 'react-native-reanimated-carousel/lib/typescript/types'

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

const BibleVerseDetailScreen = ({
  navigation,
  route,
}: StackScreenProps<MainStackProps, 'BibleVerseDetail'>) => {
  const [error, setError] = useState(false)
  const [isCarouselLoading, setIsCarouselLoading] = useState(true)
  const [strongReferences, setStrongReferences] = useState<StrongReference[]>(
    []
  )
  const [currentStrongReference, setCurrentStrongReference] = useState<
    StrongReference
  >()
  const [verse, setVerse] = useState(route.params.verse)
  const [versesInCurrentChapter, setVersesInCurrentChapter] = useState<
    number | null
  >(null)
  const [formattedTexte, setFormattedTexte] = useState('')
  const { theme, insets } = route.params
  const { t } = useTranslation()
  // const theme = useTheme()

  let _carousel = React.useRef<ICarouselInstance>(null)

  const formatVerse = async (strongVerse: any) => {
    const {
      verse: { Livre },
    } = route.params
    const { formattedTexte, references } = await verseToStrong(strongVerse)

    setFormattedTexte(formattedTexte)

    ;async () => {
      const strongReferences = await loadStrongReferences(references, Livre)

      setIsCarouselLoading(false)
      setStrongReferences(strongReferences)
      setCurrentStrongReference(strongReferences[0])

      _carousel.current?.scrollTo({ index: 0, animated: false })
      // _carousel.current?.snapToItem(0, false)
    }
  }

  const loadPage = async () => {
    const strongVerse = await loadStrongVerse(verse)

    if (!strongVerse) {
      setError(true)
      return
    }

    const versesInCurrentChapter =
      countLsgChapters[`${verse.Livre}-${verse.Chapitre}`]

    setVersesInCurrentChapter(versesInCurrentChapter)

    formatVerse(strongVerse)
  }

  useEffect(() => {
    loadPage()
  }, [])

  useEffect(() => {
    loadPage()
  }, [verse])

  const goToCarouselItem = (ref: string) => {
    const strongRef = strongReferences.find(r => r.Code === ref)
    setCurrentStrongReference(strongRef)
  }

  const onSnapToItem = (index: number) => {
    setCurrentStrongReference(strongReferences[index])
  }

  const updateVerse = (value: number) => {
    setVerse(verse => ({
      ...verse,
      Verset: verse.Verset + value,
    }))
  }

  const renderItem = ({ item, index }: { item: StrongReference, index: number }) => {
    const { isSelectionMode } = route.params || {}
    return (
      <StrongCard
        theme={theme}
        isSelectionMode={isSelectionMode}
        navigation={navigation}
        book={verse.Livre}
        strongReference={item}
        index={index}
      />
    )
  }

  const { title: headerTitle } = formatVerseContent([verse])

  return (
    <StyledScrollView
      contentContainerStyle={{ paddingBottom: 20, minHeight: hp(75) }}
      scrollIndicatorInsets={{ right: 1 }}
    >
      <Box background paddingTop={insets.top} />
      <Header
        fontSize={18}
        // bg="reverse" // attr doesn't exist
        hasBackButton
        title={`${headerTitle} ${
          headerTitle.length < 12 ? t('- Strong LSG') : '' // t must be imported as props
        }`}
        rightComponent={
          <Link
            route="DictionnaireVerseDetail"
            params={{ verse }}
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
              <NumberText>{verse.Verset}</NumberText>
            </VersetWrapper>
            <CarouselProvider
              value={{
                currentStrongReference: currentStrongReference,
                goToCarouselItem: goToCarouselItem,
              }}
            >
              <VerseText>{formattedTexte}</VerseText>
            </CarouselProvider>
          </StyledVerse>
          <BibleVerseDetailFooter
            {...{
              verseNumber: verse.Verset,
              goToNextVerse: () => {
                updateVerse(+1)
                setIsCarouselLoading(true)
              },
              goToPrevVerse: () => {
                updateVerse(-1)
                setIsCarouselLoading(true)
              },
              versesInCurrentChapter,
            }}
          />
        </Box>
        <Box bg="lightGrey">
          <RoundedCorner />
        </Box>
        <Box bg="lightGrey">
          {isCarouselLoading && <Loading />}
          {!isCarouselLoading && (
            <Carousel
              ref={_carousel}
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
              data={strongReferences}
              renderItem={renderItem}
              onSnapToItem={onSnapToItem}
              defaultIndex={strongReferences.findIndex(
                r => r.Code === currentStrongReference?.Code
              )}
            />
          )}
        </Box>
      </Box>
    </StyledScrollView>
  )
}

// export default compose<
//   any,
//   StackScreenProps<MainStackProps, 'BibleVerseDetail'>
// >(
//   // withTheme, // try with useTheme
//   // withSafeAreaInsets, // try with useSafeAreaInsets
//   connect((state, props: StackScreenProps<MainStackProps, 'BibleVerseDetail'>) => {
//     // typing redux : https://react-redux.js.org/using-react-redux/usage-with-typescript#manually-typing-connect
//     const { verse } = props.route.params || {}
//     return { verse }
//   }),
//   waitForStrongDB({
//     hasBackButton: true,
//     hasHeader: true,
//   })
// )(BibleVerseDetailScreen)

export default waitForStrongDB({
  hasBackButton: true,
  hasHeader: true,
})(BibleVerseDetailScreen)
