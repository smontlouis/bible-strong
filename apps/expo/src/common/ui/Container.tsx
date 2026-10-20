import { twMerge } from '~common/ui/classNames'
import React from 'react'
import Box, { BoxProps, SafeAreaBox } from './Box'

const Container = ({
  isSafe = true,
  isPadding = true,
  reserveBottom = false,
  ...props
}: BoxProps & { isSafe?: boolean; isPadding?: boolean; reserveBottom?: boolean }) => {
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
      reserveBottom={reserveBottom}
      {...props}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge('overflow-hidden border-continuous', props.className)
      )}
    />
  )
}

export default Container
