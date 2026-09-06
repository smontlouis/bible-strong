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
      className="border-continuous overflow-visible flex-[1] bg-primary items-center justify-center"
      onLayout={({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout
        setIconSize(Math.min(width, height) * (18 / 42))
      }}
      style={[{ borderRadius: metrics.s(21) }, { boxShadow: '0 6px 16px rgba(89,131,240,0.34)' }]}
    >
      <HStack
        className="overflow-hidden border-continuous items-center justify-center"
        style={{ gap: metrics.s(1) }}
      >
        <Feather name={icon} size={iconSize} color="#FFFFFF" />
      </HStack>
    </Box>
  )
}

export default SceneActionButton
