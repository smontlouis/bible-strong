import React from 'react'
import { AnimatedBox } from '~common/ui/Box'
import Animated, { not } from 'react-native-reanimated'
import { ShallowTimelineSection } from './types'
import SectionImage from './SectionImage'

interface Props {
  isReady: Animated.Value<number>
  currentEvent: ShallowTimelineSection
}

const CurrentSectionImage = ({ isReady, currentEvent }: Props) => {
  const opacity = not(isReady)
  return (
    <AnimatedBox absoluteFill style={{ opacity }}>
      <SectionImage {...currentEvent} />
    </AnimatedBox>
  )
}

export default CurrentSectionImage
