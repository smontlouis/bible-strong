import { useEffect } from 'react'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { OFFLINE_SETUP_MOTION } from '../offlineSetupMotion'
import type {
  OfflineSetupFolderVisual,
  OfflineSetupFrame,
  OfflineSetupHeroDirection,
} from '../offlineSetupPresentation'
import OfflineResourceFolder from './OfflineResourceFolder'
import OfflineResourceFolderBadge from './OfflineResourceFolderBadge'

export type OfflineResourceFolderHeroDirection = OfflineSetupHeroDirection

type OfflineResourceFolderHeroProps = {
  direction: OfflineSetupHeroDirection
  origin: OfflineSetupFrame
  target?: OfflineSetupFrame
  title: string
  subtitle: string
  itemCount: number
  visual: OfflineSetupFolderVisual
  selected: boolean
  onTransitionEnd: (direction: OfflineSetupHeroDirection) => void
}

const HERO_WIDTH = 190
const HERO_HEIGHT = HERO_WIDTH * (40 / 44)
const OfflineResourceFolderHero = ({
  direction,
  origin,
  target,
  title,
  subtitle,
  itemCount,
  visual,
  selected,
  onTransitionEnd,
}: OfflineResourceFolderHeroProps) => {
  const progress = useSharedValue(direction === 'opening' ? 0 : 1)

  useEffect(() => {
    if (!target || direction === 'settled') return

    const destination = direction === 'opening' ? 1 : 0
    progress.set(
      withTiming(
        destination,
        {
          duration: OFFLINE_SETUP_MOTION.hero.duration,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        },
        finished => {
          if (finished) scheduleOnRN(onTransitionEnd, direction)
        }
      )
    )
  }, [direction, onTransitionEnd, progress, target])

  const animatedStyle = useAnimatedStyle(() => {
    const destination = target ?? origin
    const originCenterX = origin.x + origin.width / 2
    const originCenterY = origin.y + origin.height / 2
    const targetCenterX = destination.x + destination.width / 2
    const targetCenterY = destination.y + destination.height / 2
    const position = progress.get()

    return {
      left:
        interpolate(position, [0, 1], [originCenterX, targetCenterX], Extrapolation.CLAMP) -
        HERO_WIDTH / 2,
      top:
        interpolate(position, [0, 1], [originCenterY, targetCenterY], Extrapolation.CLAMP) -
        HERO_HEIGHT / 2,
      transform: [
        {
          scale: interpolate(
            position,
            [0, 1],
            [origin.width / HERO_WIDTH, destination.width / HERO_WIDTH],
            Extrapolation.CLAMP
          ),
        },
      ],
    }
  })

  const folderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.get(),
      [OFFLINE_SETUP_MOTION.hero.handoffStartProgress, 1],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }))

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.get(),
      [OFFLINE_SETUP_MOTION.hero.handoffStartProgress, 1],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          overflow: 'visible',
          position: 'absolute',
          width: HERO_WIDTH,
          height: HERO_HEIGHT,
          zIndex: 30,
          opacity: direction === 'settled' ? 0 : 1,
          transitionProperty: 'opacity',
          transitionDuration: OFFLINE_SETUP_MOTION.hero.handoffDuration,
          transitionTimingFunction: 'ease-out',
        },
        animatedStyle,
      ]}
    >
      <Animated.View style={[{ position: 'absolute', inset: 0, overflow: 'visible' }, folderStyle]}>
        <OfflineResourceFolder
          width={HERO_WIDTH}
          title={title}
          subtitle={subtitle}
          icon={visual.icon}
          itemCount={itemCount}
          selected={selected}
          showChevron={false}
          colors={visual.colors}
        />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', inset: 0, overflow: 'visible' }, badgeStyle]}>
        <OfflineResourceFolderBadge itemCount={itemCount} visual={visual} width={HERO_WIDTH} />
      </Animated.View>
    </Animated.View>
  )
}

export default OfflineResourceFolderHero
