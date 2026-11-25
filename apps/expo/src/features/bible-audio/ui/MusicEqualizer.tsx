import { useEffect } from 'react'
import {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { AnimatedBox, HStack } from '~common/ui/Box'

const BAR_DELAYS = [0, 180, 360]

const Bar = ({ delay, color, height }: { delay: number; color: string; height: number }) => {
  const level = useSharedValue(0.35)
  useEffect(() => {
    level.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(withTiming(1, { duration: 420 }), withTiming(0.35, { duration: 420 })),
          -1
        )
      )
    )
    return () => cancelAnimation(level)
  }, [delay, level])
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: level.get() }] }))
  return (
    <AnimatedBox
      className="rounded-full"
      style={[{ width: 3, height, backgroundColor: color }, style]}
    />
  )
}

/** Three bars that rise and fall: music is playing, as in HelloBible's header. */
const MusicEqualizer = ({ color, size = 16 }: { color: string; size?: number }) => (
  <HStack className="items-center" style={{ gap: 2, height: size }}>
    {BAR_DELAYS.map(delay => (
      <Bar key={delay} delay={delay} color={color} height={size} />
    ))}
  </HStack>
)

export default MusicEqualizer
