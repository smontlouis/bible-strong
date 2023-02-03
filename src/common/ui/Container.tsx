import React from 'react'
import Box, { BoxProps, SafeAreaBox } from './Box'

const Container = ({
  isSafe = true,
  ...props
}: BoxProps & { isSafe?: boolean }) => {
  if (!isSafe) return <Box {...props} />
  return <SafeAreaBox {...props} />
}

export default Container
