import { useEffect, type PropsWithChildren } from 'react'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { OFFLINE_SETUP_MOTION } from '../offlineSetupMotion'
import type { OfflineSetupFolderMergeOffset } from '../offlineSetupPresentation'

const MERGE_MOTION = OFFLINE_SETUP_MOTION.download.merge

type OfflineSetupMergingFolderProps = PropsWithChildren<{
  active: boolean
  index: number
  offset?: OfflineSetupFolderMergeOffset
  reduceMotion: boolean
}>

const OfflineSetupMergingFolder = ({
  active,
  children,
  index,
  offset,
  reduceMotion,
}: OfflineSetupMergingFolderProps) => {
  const progress = useSharedValue(0)
  const destinationX = offset?.x ?? 0
  const destinationY = offset?.y ?? 0

  useEffect(() => {
    if (!active) {
      progress.set(0)
      return
    }

    if (reduceMotion) {
      progress.set(1)
      return
    }

    progress.set(
      withDelay(
        index * MERGE_MOTION.folderStagger,
        withSequence(
          withTiming(MERGE_MOTION.anticipationProgress, {
            duration: MERGE_MOTION.anticipationDuration,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(1, {
            duration: MERGE_MOTION.convergenceDuration,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })
        )
      )
    )
  }, [active, index, progress, reduceMotion])

  const positionStyle = useAnimatedStyle(() => {
    const currentProgress = progress.get()
    return {
      transform: [
        { translateX: destinationX * currentProgress },
        { translateY: destinationY * currentProgress },
      ],
    }
  })

  const appearanceStyle = useAnimatedStyle(() => {
    const currentProgress = progress.get()
    const rotationDirection = index % 2 === 0 ? -1 : 1
    const scale = interpolate(
      currentProgress,
      [MERGE_MOTION.anticipationProgress, 0, 0.78, 1],
      [1.035, 1, 0.24, 0.02],
      Extrapolation.CLAMP
    )
    const opacity = interpolate(
      currentProgress,
      [0, 0.78, 0.94, 1],
      [1, 1, 0.42, 0],
      Extrapolation.CLAMP
    )
    const rotation = interpolate(
      currentProgress,
      [0, 0.72, 1],
      [0, rotationDirection * 2.4, 0],
      Extrapolation.CLAMP
    )

    return {
      opacity,
      transform: [{ scale }, { rotate: `${rotation}deg` }],
    }
  })

  return (
    <Animated.View style={[{ overflow: 'visible' }, positionStyle]}>
      <Animated.View style={[{ overflow: 'visible' }, appearanceStyle]}>{children}</Animated.View>
    </Animated.View>
  )
}

export default OfflineSetupMergingFolder
