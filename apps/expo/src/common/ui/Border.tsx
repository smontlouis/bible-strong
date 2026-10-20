import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { StyleSheet } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import Box from './Box'

/** A hairline between two rows of a list; margins set where it starts and ends. */
const Border = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  return (
    <Box
      {...props}
      style={
        [{ height: StyleSheet.hairlineWidth }, props.style] as UIComponentProps<typeof Box>['style']
      }
      className={twMerge('bg-separator', className)}
    />
  )
}

export default Border
