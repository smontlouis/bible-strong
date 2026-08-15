import { useWindowDimensions } from 'react-native'
import type { ReactNode } from 'react'

import Box from '~common/ui/Box'

export const DESIGN_CONTENT_WIDTH = 350
export const DESIGN_STAGE_HEIGHT = 480

export type OnboardingStageMetrics = {
  width: number
  height: number
  scale: number
  s: (value: number) => number
}

type OnboardingStageProps = {
  availableHeight?: number
  children: (metrics: OnboardingStageMetrics) => ReactNode
}

/**
 * Owns the only responsive illustration canvas used by the onboarding.
 * Scene layers and graph nodes are positioned inside this canvas, so
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
