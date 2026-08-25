import React from 'react'
import { SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { AnimatedBox } from '~common/ui/Box'
import { offset } from './constants'

const Line = ({ lineX, color }: { lineX: SharedValue<number>; color: string }) => {
  return (
    <AnimatedBox
      pointerEvents="none"
      pos="absolute"
      b={0}
      l={offset}
      w={1}
      h="100%"
      bg={color}
      opacity={0.3}
      style={useAnimatedStyle(() => ({
        transform: [{ translateX: lineX.get() }],
      }))}
    />
  )
}

export default Line
