import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'

import Box from '~common/ui/Box'
import type { Theme as AppTheme } from '~themes'

const CircleImage = (
  componentProps: Omit<UIComponentProps<typeof Box>, 'theme'> & {
    theme?: AppTheme
    className?: string
    size?: number
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { size = 30 } = props
  const resolvedClassName = twMerge('bg-light-grey border-light-grey', className)
  return (
    <Box
      {...props}
      style={
        [{ width: size, height: size, borderRadius: size / 2 }, props.style] as UIComponentProps<
          typeof Box
        >['style']
      }
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

export default CircleImage
