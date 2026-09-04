import { Feather } from '@expo/vector-icons'
import { useState } from 'react'

import Box, { HStack } from '~common/ui/Box'
import type { OnboardingStageMetrics } from './OnboardingStage'

type SceneActionButtonProps = {
  icon: keyof typeof Feather.glyphMap
  metrics: OnboardingStageMetrics
}

const SceneActionButton = ({ icon, metrics }: SceneActionButtonProps) => {
  const [iconSize, setIconSize] = useState(() => metrics.s(18))

  return (
    <Box
      flex
      bg="primary"
      borderRadius={metrics.s(21)}
      center
      overflow="visible"
      onLayout={({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout
        setIconSize(Math.min(width, height) * (18 / 42))
      }}
      style={{ boxShadow: '0 6px 16px rgba(89,131,240,0.34)' }}
    >
      <HStack alignItems="center" justifyContent="center" gap={metrics.s(1)}>
        <Feather name={icon} size={iconSize} color="#FFFFFF" />
      </HStack>
    </Box>
  )
}

export default SceneActionButton
