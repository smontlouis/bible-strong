import { twMerge } from '~common/ui/classNames'
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
    <Box
      {...boxProps}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge('overflow-hidden border-continuous', boxProps.className)
      )}
    >
      {React.Children.map(children, (child, index) => {
        const spacingProp = {
          [direction === 'vertical' ? 'marginTop' : 'marginLeft']: index === 0 ? 0 : spacing * 15,
        }

        if (typeof child === 'string') {
          if (child.trim().length === 0) return null
          return <Text style={spacingProp}>{child}</Text>
        }

        if (typeof child === 'number') {
          return <Text style={spacingProp}>{child}</Text>
        }

        if (!React.isValidElement<Partial<BoxProps>>(child)) return child
        return React.cloneElement(child, { style: [spacingProp, child.props.style] })
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
    <Stack
      direction="horizontal"
      spacing={spacing}
      {...boxProps}
      className={twMerge('flex-row', boxProps.className)}
    >
      {children}
    </Stack>
  )
}
