import React from 'react'

import Carousel, { Pagination } from 'react-native-snap-carousel'
import { Button as RNPButton } from 'react-native-paper'
import { getBottomSpace } from 'react-native-iphone-x-helper'

import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import { wp } from '~helpers/utils'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'

import { getSlides, Slide } from './slides'
import { useTranslation } from 'react-i18next'

const slideWidth = wp(100)
const sliderWidth = wp(100)

const itemWidth = slideWidth

const Item = ({ item }: { item: Slide; index: number }) => {
  const r = useMediaQueriesArray()
  return (
    <Box width={wp(85)} overflow="visible" paddingHorizontal={20}>
      {/* {item.image && (
        <Image
          source={item.image}
          style={{
            width: r([wp(40), wp(80), 450, 500]),
            height: r([wp(30), wp(68), 380, 460]),
          }}
        />
      )} */}
      <Text title fontSize={30} marginTop={30}>
        {item.title}
      </Text>
      <Paragraph
        fontFamily="text"
        scale={2}
        marginTop={15}
        marginBottom={r([10, 10, 40, 40])}
      >
        {item.description}
      </Paragraph>
    </Box>
  )
}

const OnBoardingSlides = ({
  setStep,
}: {
  setStep: React.Dispatch<React.SetStateAction<number>>
}) => {
  const [activeSlide, setActiveSlide] = React.useState(0)
  const carousel = React.useRef<Carousel<Slide>>(null)
  const { t } = useTranslation()
  const slides = getSlides(t)

  return (
    <Box overflow="visible" flex pb={getBottomSpace() + 20} alignItems="center">
      <Carousel
        ref={carousel}
        data={slides}
        layoutCardOffset={15}
        renderItem={props => <Item {...props} />}
        sliderWidth={sliderWidth}
        itemWidth={itemWidth}
        inactiveSlideScale={1}
        inactiveSlideOpacity={0.3}
        contentContainerCustomStyle={{
          overflow: 'visible',
          paddingBottom: 0,
          alignItems: 'center',
        }}
        onSnapToItem={setActiveSlide}
        useScrollView={false}
      />
      <Pagination
        dotsLength={slides.length}
        activeDotIndex={activeSlide}
        containerStyle={{
          paddingVertical: 10,
        }}
        dotContainerStyle={{
          width: 10,
          marginHorizontal: 3,
        }}
        dotStyle={{
          width: 10,
          height: 10,
          borderRadius: 5,
          marginHorizontal: 8,
          backgroundColor: 'rgba(0, 0, 0, 0.92)',
        }}
        inactiveDotOpacity={0.4}
        inactiveDotScale={0.6}
        carouselRef={carousel.current}
        tappableDots={!!carousel.current}
      />
      <Box width={170} marginTop={20}>
        {activeSlide === 3 ? (
          <Button onPress={() => setStep(1)}>{t('Commencer')}</Button>
        ) : (
          <Button onPress={() => carousel.current?.snapToNext()}>
            {t('Suivant')}
          </Button>
        )}
        <RNPButton
          style={{ marginTop: 5 }}
          mode="text"
          onPress={() => setStep(1)}
          labelStyle={{ fontSize: 12 }}
        >
          {t('Passer')}
        </RNPButton>
      </Box>
    </Box>
  )
}

export default OnBoardingSlides
