import React from 'react'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { millisToMinutes } from '~helpers/millisToMinutes'

type AudioBarProps = {
  positionMillis?: number
  durationMillis?: number
}

const AudioBar = ({ positionMillis, durationMillis }: AudioBarProps) => {
  const progress =
    positionMillis && durationMillis
      ? (positionMillis * 100) / durationMillis
      : 0
  return (
    <Box position="relative">
      <Box height={4} position="relative" backgroundColor="rgba(0,0,0,0.2)">
        <Box
          width={`${progress}%`}
          pos="absolute"
          top={0}
          height={4}
          left={0}
          bg="primary"
        />
      </Box>
      <Box row marginTop={3}>
        <Text fontSize={10}>
          {positionMillis ? millisToMinutes(positionMillis) : '--:--'}
        </Text>
        <Box flex />
        <Text fontSize={10}>
          {durationMillis ? millisToMinutes(durationMillis) : '--:--'}
        </Text>
      </Box>
    </Box>
  )
}

export default AudioBar
