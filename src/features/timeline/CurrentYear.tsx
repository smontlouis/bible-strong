import React from 'react'
import { AnimatedBox } from '~common/ui/Box'
import { offset } from './constants'
import { ReText } from 'react-native-redash'
import Animated from 'react-native-reanimated'
import { getBottomSpace } from 'react-native-iphone-x-helper'

const CurrentYear = ({
  year,
  lineX,
  color,
}: {
  year: Animated.Node<string>
  lineX: Animated.Node<number>
  color: string
}) => {
  return (
    <AnimatedBox
      pos="absolute"
      l={offset - 60}
      b={getBottomSpace() + 6}
      bg={color}
      p={10}
      width={120}
      center
      borderRadius={5}
      style={{ transform: [{ translateX: lineX }] }}
    >
      <ReText text={year} style={{ color: 'white', fontWeight: 'bold' }} />
    </AnimatedBox>
  )
}

export default CurrentYear
