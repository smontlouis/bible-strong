import React from 'react'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { secondsToMinutes } from '~helpers/secondsToMinutes'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
type AudioBarProps = {
  position?: number
  duration?: number
}

const AudioBar = ({ position, duration }: AudioBarProps) => {
  const theme = useTheme()
  const progress = position && duration ? (position * 100) / duration : 0
  return (
    <Box className="overflow-hidden border-continuous relative">
      <Box
        className="overflow-hidden border-continuous h-[4px] relative rounded-full"
        style={{ backgroundColor: colorWithOpacity(theme.colors.default, 0.15) }}
      >
        <Box
          className="overflow-hidden border-continuous absolute top-[0px] h-[4px] left-[0px] bg-primary rounded-full"
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
