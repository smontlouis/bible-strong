import React from 'react'
import { useTheme } from '@emotion/react'
import { AnimatedProgressCircle } from '@convective/react-native-reanimated-progress'

type Props = {
  progress: number
  size?: number
  thickness?: number
}

const Progress = ({ progress, size = 40, thickness = 3 }: Props) => {
  const theme = useTheme()
  return (
    <AnimatedProgressCircle
      size={size}
      progress={progress}
      thickness={thickness}
      color={theme.colors.primary}
      unfilledColor={theme.colors.lightGrey}
      animationDuration={300}
    />
  )
}

export default Progress
