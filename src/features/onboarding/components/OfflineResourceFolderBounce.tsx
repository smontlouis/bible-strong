import { useEffect, useRef, type ReactNode } from 'react'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

type OfflineResourceFolderBounceProps = {
  children: ReactNode
  itemCount: number
  width: number
}

const OfflineResourceFolderBounce = ({
  children,
  itemCount,
  width,
}: OfflineResourceFolderBounceProps) => {
  const reduceMotion = useReducedMotion()
  const bounceProgress = useSharedValue(0)
  const previousItemCount = useRef(itemCount)
  const bounceDistance = Math.max(1, (width / 170) * 2.5)

  useEffect(() => {
    if (previousItemCount.current === itemCount) return
    previousItemCount.current = itemCount
    if (reduceMotion) return

    bounceProgress.set(
      withSequence(
        withTiming(1, { duration: 90 }),
        withSpring(0, { damping: 14, stiffness: 220, mass: 0.55 })
      )
    )
  }, [bounceProgress, itemCount, reduceMotion])

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -bounceDistance * bounceProgress.get() },
      { scale: 1 + 0.012 * bounceProgress.get() },
    ],
  }))

  return (
    <Animated.View style={[{ position: 'absolute', inset: 0, overflow: 'visible' }, bounceStyle]}>
      {children}
    </Animated.View>
  )
}

export default OfflineResourceFolderBounce
