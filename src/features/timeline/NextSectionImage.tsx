import React from 'react'
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'
import { wp, wpUI } from '~helpers/utils'
import SectionImage from './SectionImage'
import { ShallowTimelineSection } from './types'

interface Props {
  x: Animated.SharedValue<number>
  width: number
  nextEvent: ShallowTimelineSection
}

const NextSectionImage = ({ x, width, nextEvent }: Props) => {
  const style = useAnimatedStyle(() => {
    const opacity = interpolate(
      x.value * -1,
      [width - wpUI(100), width],
      [0, 1],
      Extrapolation.EXTEND
    )
    return { opacity }
  })

  return (
    <AnimatedBox absoluteFill style={style}>
      <SectionImage direction="next" {...nextEvent} />
    </AnimatedBox>
  )
}

export default NextSectionImage
