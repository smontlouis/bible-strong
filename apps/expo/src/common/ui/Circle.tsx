import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

const Circle = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.View>,
    | keyof {
        isSelected: boolean
        color: string
        size: number
      }
    | 'theme'
  > &
    Omit<
      {
        isSelected: boolean
        color: string
        size: number
      },
      'theme'
    > & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isSelected, color, size } = props
  const resolvedClassName = twMerge('border-[2px] ml-[10px]', className)
  return (
    <NativeUI.View
      {...props}
      className={resolvedClassName}
      style={
        [
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            borderColor: isSelected ? theme.colors.primary : theme.colors.opacity5,
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.View>['style']
      }
    />
  )
}

export default Circle
