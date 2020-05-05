import React from 'react'
import { AnimatedBox } from '~common/ui/Box'
import Animated, {
  interpolate,
  multiply,
  Extrapolate,
} from 'react-native-reanimated'
import { wp } from '~helpers/utils'
import { ShallowTimelineSection } from './types'
import SectionImage from './SectionImage'

interface Props {
  x: Animated.Value<number>
  width: number
  nextEvent: ShallowTimelineSection
}

const NextSectionImage = ({ x, width, nextEvent }: Props) => {
  const opacity = interpolate(multiply(x, -1), {
    inputRange: [width - wp(100), width],
    outputRange: [0, 1],
    extrapolate: Extrapolate.EXTEND,
  })

  return (
    <AnimatedBox absoluteFill style={{ opacity }}>
      <SectionImage direction="next" {...nextEvent} />
    </AnimatedBox>
  )
}

export default NextSectionImage
