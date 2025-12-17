import React from 'react'
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'
import { wpUI } from '~helpers/utils'
import SectionImage from './SectionImage'
import { ShallowTimelineSection } from './types'

interface Props {
  x: Animated.SharedValue<number>
  prevEvent: ShallowTimelineSection
}

const PrevSectionImage = ({ x, prevEvent }: Props) => {
  const style = useAnimatedStyle(() => {
    const opacity = interpolate(x.value, [0, wpUI(100)], [0, 1], Extrapolation.CLAMP)
    return { opacity }
  })

  return (
    <AnimatedBox absoluteFill style={style}>
      <SectionImage direction="previous" {...prevEvent} />
    </AnimatedBox>
  )
}

export default PrevSectionImage
