import React from 'react'
import Box, { BoxProps } from './Box'

export type StackProps = {
  children?: React.ReactNode[] | React.ReactNode
  spacing?: number
}

const Stack = ({
  children,
  direction,
  spacing = 1,
  ...boxProps
}: StackProps & BoxProps & { direction: 'horizontal' | 'vertical' }) => {
  return (
    <Box {...boxProps}>
      {React.Children.map(children, (child, index) => {
        if (!child) return null
        return React.cloneElement(child, {
          [direction === 'vertical' ? 'marginTop' : 'marginLeft']:
            index === 0 ? 0 : spacing * 15,
        })
      })}
    </Box>
  )
}

export const VStack = ({
  children,
  spacing = 1,
  ...boxProps
}: StackProps & BoxProps) => {
  return (
    <Stack direction="vertical" spacing={spacing} {...boxProps}>
      {children}
    </Stack>
  )
}

export const HStack = ({
  children,
  spacing = 0.5,
  ...boxProps
}: StackProps & BoxProps) => {
  return (
    <Stack row direction="horizontal" spacing={spacing} {...boxProps}>
      {children}
    </Stack>
  )
}
