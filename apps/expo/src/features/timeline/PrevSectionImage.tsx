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
  prevEvent: ShallowTimelineSection
}

const PrevSectionImage = ({ x, prevEvent }: Props) => {
  const style = useAnimatedStyle(() => {
    const opacity = interpolate(x.get(), [0, wpUI(100)], [0, 1], Extrapolation.CLAMP)
    return { opacity }
  })

  return (
    <AnimatedBox className="absolute left-[0px] top-[0px] right-[0px] bottom-[0px]" style={style}>
      <SectionImage direction="previous" {...prevEvent} />
    </AnimatedBox>
  )
}

export default PrevSectionImage
