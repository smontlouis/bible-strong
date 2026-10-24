import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { titleFontStyle } from '~themes/styleValues'
import React from 'react'
import { Image } from 'react-native'
import { Carousel, type CarouselRef } from 'react-native-reanimated-carousel'
import { configureCarouselPan } from '~helpers/configureCarouselPan'
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
  const stylingTheme = useStylingTheme()

  const r = useMediaQueriesArray()
  return (
    <VStack className="px-[20px] justify-center bg-reverse overflow-visible flex-[1]" spacing={2}>
      {item.image && (
        <Image
          source={item.image}
          style={{
            width: r([wp(40), wp(80), 450, 500]),
            height: r([wp(30), wp(68), 380, 460]),
          }}
        />
      )}
      <Text className="text-[38px]" style={titleFontStyle(stylingTheme)}>
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
  const carousel = React.useRef<CarouselRef>(null)
  const { t } = useTranslation()
  const slides = getSlides(t)
  const {
    ref: carouselContainerRef,
    size: carouselContainerSize,
    onLayout: onCarouselContainerLayout,
  } = useLayoutSize()

  return (
    <SafeAreaBox reserveBottom className="overflow-hidden border-continuous">
      <Box
        className="overflow-hidden border-continuous items-center justify-center flex-[1]"
        ref={carouselContainerRef}
        onLayout={onCarouselContainerLayout}
      >
        <Carousel
          ref={carousel}
          layout={{
            type: 'horizontal-stack',
            opacityStep: 0.8,
            scaleStep: 0,
            spacing: itemWidth,
            rotation: 0,
          }}
          data={slides}
          loop={false}
          onConfigurePanGesture={configureCarouselPan([-3, 3])}
          renderItem={props => <Item {...props} />}
          style={{
            width: sliderWidth,
            height: carouselContainerSize.height,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          itemSize={itemWidth}
          onSnapToItem={setActiveSlide}
        />
      </Box>
      <Box className="overflow-hidden border-continuous mt-[20px] mx-[20px]">
        {activeSlide === 3 ? (
          <Button onPress={() => setStep(1)}>{t('Commencer')}</Button>
        ) : (
          <Button onPress={() => carousel.current?.next()}>{t('Suivant')}</Button>
        )}
        <TouchableBox
          className="overflow-hidden border-continuous mt-[20px] items-center justify-center"
          onPress={() => setStep(1)}
        >
          <Text className="text-[12px]">{t('Passer').toUpperCase()}</Text>
        </TouchableBox>
      </Box>
    </SafeAreaBox>
  )
}

export default OnBoardingSlides
