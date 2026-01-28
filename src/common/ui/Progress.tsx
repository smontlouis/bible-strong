import React from 'react'
import { useTheme } from '@emotion/react'
import { AnimatedProgressCircle } from '@convective/react-native-reanimated-progress'

type Props = {
  progress: number
}

const Progress = ({ progress }: Props) => {
  const theme = useTheme()
  return (
    <AnimatedProgressCircle
      size={40}
      progress={progress}
      thickness={3}
      color={theme.colors.primary}
      unfilledColor={theme.colors.lightGrey}
      animationDuration={300}
    />
  )
}

export default Progress
