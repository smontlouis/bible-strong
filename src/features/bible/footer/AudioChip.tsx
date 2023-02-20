import React from 'react'
import Box, { BoxProps } from '~common/ui/Box'

const AudioChip = ({
  isActive,
  ...props
}: BoxProps & {
  isActive?: boolean
}) => {
  return (
    <Box
      px={8}
      height={26}
      maxW={80}
      row
      borderColor={isActive ? 'primary' : 'border'}
      borderWidth={1}
      borderRadius={10}
      center
      {...props}
    />
  )
}

export default AudioChip
