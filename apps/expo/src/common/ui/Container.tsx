import { twMerge } from '~common/ui/classNames'
import React from 'react'
import Box, { BoxProps, SafeAreaBox } from './Box'

const Container = ({
  isSafe = true,
  isPadding = true,
  ...props
}: BoxProps & { isSafe?: boolean; isPadding?: boolean }) => {
  if (!isSafe)
    return (
      <Box
        {...props}
        className={twMerge(
          'overflow-hidden border-continuous',
          twMerge('overflow-hidden border-continuous', props.className)
        )}
      />
    )
  return (
    <SafeAreaBox
      isPadding={isPadding}
      {...props}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge('overflow-hidden border-continuous', props.className)
      )}
    />
  )
}

export default Container
