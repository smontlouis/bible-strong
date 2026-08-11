import { useEffect } from 'react'
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

import { AnimatedBox } from '~common/ui/Box'

type SceneBackgroundShapeProps = {
  borderRadius: number
  reduceMotion: boolean
}

const SceneBackgroundShape = ({ borderRadius, reduceMotion }: SceneBackgroundShapeProps) => {
  const animatedBorderRadius = useSharedValue(borderRadius)

  useEffect(() => {
    animatedBorderRadius.set(reduceMotion ? borderRadius : withSpring(borderRadius))
  }, [animatedBorderRadius, borderRadius, reduceMotion])

  const animatedStyle = useAnimatedStyle(() => ({
    borderRadius: animatedBorderRadius.get(),
  }))

  return <AnimatedBox flex bg="lightPrimary" style={animatedStyle} />
}

export default SceneBackgroundShape
