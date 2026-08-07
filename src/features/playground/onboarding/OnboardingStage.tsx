import { useWindowDimensions } from 'react-native'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import Box, { AnimatedBox } from '~common/ui/Box'

export const DESIGN_CONTENT_WIDTH = 350
export const DESIGN_STAGE_HEIGHT = 480

export type OnboardingStageMetrics = {
  width: number
  height: number
  scale: number
  s: (value: number) => number
}

export type SceneActorLayout = {
  x: number
  y: number
  width: number
  height: number
  scale?: number
  rotation?: number
  opacity?: number
  zIndex?: number
}

type OnboardingStageProps = {
  availableHeight?: number
  children: (metrics: OnboardingStageMetrics) => ReactNode
}

type OnboardingSceneLayerProps = {
  sceneKey: string
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
  zIndex?: number
  children: ReactNode
}

type PersistentActorProps = {
  layout: SceneActorLayout
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
  children: ReactNode
}

const timing = (value: number, reduceMotion: boolean) =>
  reduceMotion ? value : withTiming(value, { duration: 560 })

/**
 * Owns the only responsive illustration canvas used by the onboarding.
 * Scene layers and persistent actors are positioned inside this canvas, so
 * scenes never create competing flex layouts or independent coordinate systems.
 */
export const OnboardingStage = ({ availableHeight, children }: OnboardingStageProps) => {
  const { width, height } = useWindowDimensions()
  const contentWidth = Math.max(width - 40, 1)
  const widthScale = Math.min(1, contentWidth / DESIGN_CONTENT_WIDTH)
  const fallbackHeight = Math.max(height - 250, 1)
  const sceneHeight = availableHeight && availableHeight > 0 ? availableHeight : fallbackHeight
  const heightScale = Math.min(1, sceneHeight / DESIGN_STAGE_HEIGHT)
  const scale = Math.max(0.01, Math.min(widthScale, heightScale))
  const metrics: OnboardingStageMetrics = {
    width: DESIGN_CONTENT_WIDTH * scale,
    height: DESIGN_STAGE_HEIGHT * scale,
    scale,
    s: value => value * scale,
  }

  return (
    <Box flex width="100%" alignItems="center" justifyContent="center" overflow="visible">
      <Box width={metrics.width} height={metrics.height} position="relative" overflow="visible">
        {children(metrics)}
      </Box>
    </Box>
  )
}

/**
 * A scene-specific layer. Its absolute canvas is keyed so the outgoing layer
 * can finish its exit animation while the incoming layer enters above it.
 */
export const OnboardingSceneLayer = ({
  sceneKey,
  metrics,
  reduceMotion,
  zIndex = 1,
  children,
}: OnboardingSceneLayerProps) => (
  <AnimatedBox
    key={sceneKey}
    position="absolute"
    left={0}
    top={0}
    width={metrics.width}
    height={metrics.height}
    overflow="visible"
    zIndex={zIndex}
    entering={reduceMotion ? undefined : FadeIn.duration(260)}
    exiting={reduceMotion ? undefined : FadeOut.duration(220)}
  >
    {children}
  </AnimatedBox>
)

/**
 * Keeps an actor mounted across scene changes and animates it to the next
 * layout. A stable actor id is supplied by the caller through React's tree;
 * the actor itself never belongs to a scene-specific layer.
 */
export const PersistentActor = ({
  layout,
  metrics,
  reduceMotion,
  children,
}: PersistentActorProps) => {
  const x = useSharedValue(layout.x)
  const y = useSharedValue(layout.y)
  const scale = useSharedValue(layout.scale ?? 1)
  const rotation = useSharedValue(layout.rotation ?? 0)
  const opacity = useSharedValue(layout.opacity ?? 1)

  useEffect(() => {
    x.set(timing(layout.x, reduceMotion))
    y.set(timing(layout.y, reduceMotion))
    scale.set(timing(layout.scale ?? 1, reduceMotion))
    rotation.set(timing(layout.rotation ?? 0, reduceMotion))
    opacity.set(timing(layout.opacity ?? 1, reduceMotion))
  }, [layout, reduceMotion, x, y, scale, rotation, opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    left: x.get() * metrics.scale,
    top: y.get() * metrics.scale,
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }, { rotate: `${rotation.get()}deg` }],
  }))

  return (
    <AnimatedBox
      position="absolute"
      width={metrics.s(layout.width)}
      height={metrics.s(layout.height)}
      zIndex={layout.zIndex ?? 4}
      overflow="visible"
      style={animatedStyle}
    >
      {children}
    </AnimatedBox>
  )
}
