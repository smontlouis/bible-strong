import type { ReactNode } from 'react'
import Animated, { FadeInLeft, FadeInRight, ReduceMotion } from 'react-native-reanimated'

export default function PanelTransition({
  children,
  direction,
}: {
  children: ReactNode
  direction: 'forward' | 'backward'
}) {
  const entering = (direction === 'forward' ? FadeInRight : FadeInLeft)
    .duration(200)
    .withInitialValues({
      opacity: 0,
      transform: [{ translateX: direction === 'forward' ? 10 : -10 }],
    })
    .reduceMotion(ReduceMotion.System)
  return <Animated.View entering={entering}>{children}</Animated.View>
}
