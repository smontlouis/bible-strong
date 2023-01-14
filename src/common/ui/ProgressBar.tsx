import React from 'react'
import Box from './Box'

export interface ProgressBarProps {
  progress: number
}

export const ProgressBar = ({ progress }: ProgressBarProps) => {
  return (
    <Box
      bg="reverse"
      borderColor="lightPrimary"
      borderWidth={0}
      padding={0}
      borderRadius={20}
    >
      <Box bg="lightGrey" height={8} borderRadius={20}>
        <Box
          absoluteFill
          backgroundColor="primary"
          width={`${progress * 100}%`}
          borderRadius={20}
        />
      </Box>
    </Box>
  )
}
