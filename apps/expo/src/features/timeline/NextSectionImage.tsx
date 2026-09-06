import React from 'react'
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'
import { wpUI } from '~helpers/utils'
import SectionImage from './SectionImage'
import { ShallowTimelineSection } from './types'
interface Props {
  x: SharedValue<number>
  width: number
  nextEvent: ShallowTimelineSection
}

const NextSectionImage = ({ x, width, nextEvent }: Props) => {
  const style = useAnimatedStyle(() => {
    const opacity = interpolate(
      x.get() * -1,
      [width - wpUI(100), width],
      [0, 1],
      Extrapolation.EXTEND
    )
    return { opacity }
  })

  return (
    <AnimatedBox className="absolute left-[0px] top-[0px] right-[0px] bottom-[0px]" style={style}>
      <SectionImage direction="next" {...nextEvent} />
    </AnimatedBox>
  )
}

export default NextSectionImage
