import React from 'react'

import { Image } from 'react-native'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'

import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import { useLayoutSize } from '~helpers/useLayoutSize'
import { wp } from '~helpers/utils'

import Box, { SafeAreaBox, TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'

import { useTranslation } from 'react-i18next'
import { VStack } from '~common/ui/Stack'
import { getSlides, Slide } from './slides'

const slideWidth = wp(100)
const sliderWidth = wp(100)

const itemWidth = slideWidth

const Item = ({ item }: { item: Slide; index: number }) => {
  const r = useMediaQueriesArray()
  return (
    <VStack overflow="visible" px={20} spacing={2} flex justifyContent="center" bg="reverse">
      {item.image && (
        <Image
          source={item.image}
          style={{
            width: r([wp(40), wp(80), 450, 500]),
            height: r([wp(30), wp(68), 380, 460]),
          }}
        />
      )}
      <Text title fontSize={38}>
        {item.title}
      </Text>
      <Paragraph fontFamily="text" scale={2}>
        {item.description}
      </Paragraph>
    </VStack>
  )
}

const OnBoardingSlides = ({
  setStep,
}: {
  setStep: React.Dispatch<React.SetStateAction<number>>
}) => {
  const [activeSlide, setActiveSlide] = React.useState(0)
  const carousel = React.useRef<ICarouselInstance>(null)
  const { t } = useTranslation()
  const slides = getSlides(t)
  const {
    ref: carouselContainerRef,
    size: carouselContainerSize,
    onLayout: onCarouselContainerLayout,
  } = useLayoutSize()

  return (
    <SafeAreaBox>
      <Box ref={carouselContainerRef} center flex onLayout={onCarouselContainerLayout}>
        <Carousel
          ref={carousel}
          mode="horizontal-stack"
          data={slides}
          loop={false}
          scrollAnimationDuration={400}
          onConfigurePanGesture={gestureChain => {
            gestureChain.activeOffsetX([-3, 3])
          }}
          modeConfig={{
            opacityInterval: 0.8,
            scaleInterval: 0,
            stackInterval: itemWidth,
            rotateZDeg: 0,
          }}
          renderItem={props => <Item {...props} />}
          style={{
            width: sliderWidth,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          width={itemWidth}
          height={carouselContainerSize.height}
          onScrollEnd={setActiveSlide}
        />
      </Box>
      <Box marginTop={20} mx={20}>
        {activeSlide === 3 ? (
          <Button onPress={() => setStep(1)}>{t('Commencer')}</Button>
        ) : (
          <Button onPress={() => carousel.current?.next()}>{t('Suivant')}</Button>
        )}
        <TouchableBox onPress={() => setStep(1)} marginTop={20} center>
          <Text fontSize={12}>{t('Passer').toUpperCase()}</Text>
        </TouchableBox>
      </Box>
    </SafeAreaBox>
  )
}

export default OnBoardingSlides
