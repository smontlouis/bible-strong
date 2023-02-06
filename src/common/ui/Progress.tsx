import React from 'react'
import { useTheme } from '@emotion/react'
import ProgressCircle from 'react-native-progress/Circle'

type Props = {
  progress: number
}

const Progress = ({ progress }: Props) => {
  const theme = useTheme()
  return (
    <ProgressCircle
      size={40}
      progress={progress}
      borderWidth={0}
      thickness={3}
      color={theme.colors.primary}
      unfilledColor={theme.colors.lightGrey}
      fill="none"
    />
  )
}

export default Progress
