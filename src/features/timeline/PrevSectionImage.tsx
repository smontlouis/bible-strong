import React from 'react'
import { AnimatedBox } from '~common/ui/Box'
import Animated, { interpolate, Extrapolate } from 'react-native-reanimated'
import { wp } from '~helpers/utils'
import { ShallowTimelineSection } from './types'
import SectionImage from './SectionImage'

interface Props {
  x: Animated.Value<number>
  prevEvent: ShallowTimelineSection
}

const PrevSectionImage = ({ x, prevEvent }: Props) => {
  const opacity = interpolate(x, {
    inputRange: [0, wp(100)],
    outputRange: [0, 1],
    extrapolate: Extrapolate.CLAMP,
  })
  return (
    <AnimatedBox absoluteFill style={{ opacity }}>
      <SectionImage direction="previous" {...prevEvent} />
    </AnimatedBox>
  )
}

export default PrevSectionImage
