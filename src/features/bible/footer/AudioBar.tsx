import React from 'react'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { secondsToMinutes } from '~helpers/secondsToMinutes'

type AudioBarProps = {
  position?: number
  duration?: number
}

const AudioBar = ({ position, duration }: AudioBarProps) => {
  const progress = position && duration ? (position * 100) / duration : 0
  return (
    <Box position="relative">
      <Box height={4} position="relative" backgroundColor="rgba(0,0,0,0.2)" borderRadius={5}>
        <Box
          width={`${progress}%`}
          pos="absolute"
          top={0}
          height={4}
          left={0}
          bg="primary"
          borderRadius={5}
        />
      </Box>
      <Box row marginTop={3}>
        <Text fontSize={10}>{position ? secondsToMinutes(position) : '--:--'}</Text>
        <Box flex />
        <Text fontSize={10}>{duration ? secondsToMinutes(duration) : '--:--'}</Text>
      </Box>
    </Box>
  )
}

export default AudioBar
