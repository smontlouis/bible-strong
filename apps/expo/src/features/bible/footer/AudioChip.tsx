import { twMerge } from '~common/ui/classNames'
import React from 'react'
import Box, { BoxProps } from '~common/ui/Box'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'

const AudioChip = ({
  isActive,
  ...props
}: BoxProps & {
  isActive?: boolean
}) => {
  const theme = useTheme()
  // A pill filled with a tint, the primary one when the option is on: no outline.
  return (
    <Box
      {...props}
      style={[
        {
          backgroundColor: isActive
            ? colorWithOpacity(theme.colors.primary, 0.12)
            : colorWithOpacity(theme.colors.default, 0.07),
        },
        props.style,
      ]}
      className={twMerge(
        'overflow-hidden border-continuous px-[10px] h-[26px] max-w-[90px] rounded-full items-center justify-center flex-row',
        props.className
      )}
    />
  )
}

export default AudioChip
