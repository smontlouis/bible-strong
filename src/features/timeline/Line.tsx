import React from 'react'
import { AnimatedBox } from '~common/ui/Box'
import { offset } from './constants'
import Animated from 'react-native-reanimated'

const Line = ({
  lineX,
  color,
}: {
  lineX: Animated.Node<number>
  color: string
}) => {
  return (
    <AnimatedBox
      pos="absolute"
      b={0}
      l={offset}
      w={1}
      h="100%"
      bg={color}
      opacity={0.3}
      style={{ transform: [{ translateX: lineX }] }}
    />
  )
}

export default Line
