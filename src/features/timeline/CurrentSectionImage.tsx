import React from 'react'
import { SharedValue, useAnimatedStyle, useDerivedValue } from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'
import SectionImage from './SectionImage'
import { ShallowTimelineSection } from './types'

interface Props {
  isReady: SharedValue<number>
  currentEvent: ShallowTimelineSection
}

const CurrentSectionImage = ({ isReady, currentEvent }: Props) => {
  const opacity = useDerivedValue(() => (isReady.value === 1 ? 0 : 1))

  const style = useAnimatedStyle(() => {
    return { opacity: opacity.value }
  })

  return (
    <AnimatedBox absoluteFill style={style}>
      <SectionImage {...currentEvent} />
    </AnimatedBox>
  )
}

export default CurrentSectionImage
