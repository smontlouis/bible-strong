import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import Box from './Box'

interface RoundedCornerProps {
  reverse?: boolean
}

const RoundedCorner = (
  componentProps: Omit<UIComponentProps<typeof Box>, keyof RoundedCornerProps | 'theme'> &
    Omit<RoundedCornerProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { reverse } = props
  const resolvedClassName = twMerge('h-[30px] bg-reverse', className)
  return (
    <Box
      {...props}
      style={
        [
          {
            ...(reverse
              ? {
                  borderTopLeftRadius: 30,
                  borderTopRightRadius: 30,
                }
              : {
                  borderBottomLeftRadius: 30,
                  borderBottomRightRadius: 30,
                }),
          },
          props.style,
        ] as UIComponentProps<typeof Box>['style']
      }
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

export default RoundedCorner
