import React from 'react'
import Box, { BoxProps, SafeAreaBox } from './Box'

const Container = ({
  isSafe = true,
  isPadding = true,
  ...props
}: BoxProps & { isSafe?: boolean; isPadding?: boolean }) => {
  if (!isSafe) return <Box {...props} />
  return <SafeAreaBox isPadding={isPadding} {...props} />
}

export default Container
