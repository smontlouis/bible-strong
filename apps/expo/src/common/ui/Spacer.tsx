import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import Box from './Box'

interface SpacerProps {
  size?: number
}

const Spacer = (
  componentProps: Omit<UIComponentProps<typeof Box>, keyof SpacerProps | 'theme'> &
    Omit<SpacerProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { size = 1 } = props
  const resolvedClassName = twMerge('', className)
  return (
    <Box
      {...props}
      style={[{ marginTop: size * 15 }, props.style] as UIComponentProps<typeof Box>['style']}
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

export default Spacer
