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
    <Box className="overflow-hidden border-continuous relative">
      <Box className="overflow-hidden border-continuous h-[4px] relative bg-[rgba(0,0,0,0.2)] rounded-[5px]">
        <Box
          className="overflow-hidden border-continuous absolute top-[0px] h-[4px] left-[0px] bg-primary rounded-[5px]"
          style={{ width: `${progress}%` }}
        />
      </Box>
      <Box className="overflow-hidden border-continuous flex-row mt-[3px]">
        <Text className="text-[10px]">{position ? secondsToMinutes(position) : '--:--'}</Text>
        <Box className="overflow-hidden border-continuous flex-[1]" />
        <Text className="text-[10px]">{duration ? secondsToMinutes(duration) : '--:--'}</Text>
      </Box>
    </Box>
  )
}

export default AudioBar
