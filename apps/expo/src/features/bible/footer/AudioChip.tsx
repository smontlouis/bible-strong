import { twMerge } from '~common/ui/classNames'
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
      {...props}
      style={props.style}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge(
          isActive ? 'border-primary' : 'border-border',
          twMerge(
            'overflow-hidden border-continuous px-[8px] h-[26px] max-w-[90px] border-[1px] rounded-[10px] items-center justify-center flex-row',
            props.className
          )
        )
      )}
    />
  )
}

export default AudioChip
