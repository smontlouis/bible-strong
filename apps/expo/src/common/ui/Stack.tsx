import React from 'react'
import Box, { BoxProps } from './Box'
import Text from './Text'

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
        const spacingProp = {
          [direction === 'vertical' ? 'marginTop' : 'marginLeft']: index === 0 ? 0 : spacing * 15,
        }

        if (typeof child === 'string') {
          if (child.trim().length === 0) return null
          return <Text {...spacingProp}>{child}</Text>
        }

        if (typeof child === 'number') {
          return <Text {...spacingProp}>{child}</Text>
        }

        if (!React.isValidElement<Partial<BoxProps>>(child)) return child
        return React.cloneElement(child, spacingProp)
      })}
    </Box>
  )
}

/**
 *
 * Deprecated: Use VStack from Box instead
 */
export const VStack = ({ children, spacing = 1, ...boxProps }: StackProps & BoxProps) => {
  return (
    <Stack direction="vertical" spacing={spacing} {...boxProps}>
      {children}
    </Stack>
  )
}

/**
 * Deprecated: Use HStack from Box instead
 */
export const HStack = ({ children, spacing = 0.5, ...boxProps }: StackProps & BoxProps) => {
  return (
    <Stack row direction="horizontal" spacing={spacing} {...boxProps}>
      {children}
    </Stack>
  )
}
