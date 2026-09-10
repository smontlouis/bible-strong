import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'

import Box from '~common/ui/Box'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

interface IconCircleProps {
  bg?: string
  size?: number
}

const IconCircle = (
  componentProps: Omit<UIComponentProps<typeof Box>, keyof IconCircleProps | 'theme'> &
    Omit<IconCircleProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { bg, size = 36 } = props
  const resolvedClassName = twMerge('rounded-[10px] items-center justify-center', className)
  return (
    <Box
      {...props}
      style={
        [
          {
            width: size,
            height: size,
            backgroundColor: bg
              ? theme.colors[bg as keyof typeof theme.colors] || bg
              : theme.colors.lightPrimary,
          },
          props.style,
        ] as UIComponentProps<typeof Box>['style']
      }
      className={twMerge('overflow-hidden border-continuous', resolvedClassName)}
    />
  )
}

export default IconCircle
