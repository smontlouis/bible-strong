import * as Icon from '@expo/vector-icons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import Text from '~common/ui/Text'

interface IconStyleProps {
  color?: string
}

export const FeatherIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.Feather>, keyof IconStyleProps | 'theme'> &
    Omit<IconStyleProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color = 'default' } = props
  const classStyles = useResolveClassNames(twMerge('', className))
  return (
    <Icon.Feather
      {...props}
      style={
        [
          classStyles,
          {
            color:
              theme.colors[color as keyof typeof theme.colors] || color || theme.colors.default,
          },
          props.style,
        ] as UIComponentProps<typeof Icon.Feather>['style']
      }
    />
  )
}

export const IonIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.Ionicons>, keyof IconStyleProps | 'theme'> &
    Omit<IconStyleProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color = 'default' } = props
  const classStyles = useResolveClassNames(twMerge('', className))
  return (
    <Icon.Ionicons
      {...props}
      style={
        [
          classStyles,
          {
            color:
              theme.colors[color as keyof typeof theme.colors] || color || theme.colors.default,
          },
          props.style,
        ] as UIComponentProps<typeof Icon.Ionicons>['style']
      }
    />
  )
}

export const MaterialIcon = (
  componentProps: Omit<
    UIComponentProps<typeof Icon.MaterialIcons>,
    keyof IconStyleProps | 'theme'
  > &
    Omit<IconStyleProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color } = props
  const classStyles = useResolveClassNames(twMerge('', className))
  return (
    <Icon.MaterialIcons
      {...props}
      style={
        [
          classStyles,
          {
            color:
              theme.colors[color as keyof typeof theme.colors] || color || theme.colors.default,
          },
          props.style,
        ] as UIComponentProps<typeof Icon.MaterialIcons>['style']
      }
    />
  )
}

export const TextIcon = (
  componentProps: Omit<UIComponentProps<typeof Text>, keyof IconStyleProps | 'theme'> &
    Omit<IconStyleProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color } = props
  const classStyles = useResolveClassNames(twMerge('text-[16px] font-bold mr-[5px]', className))
  return (
    <Text
      {...props}
      style={
        [
          classStyles,
          { color: theme.colors[color as keyof typeof theme.colors] || theme.colors.default },
          props.style,
        ] as UIComponentProps<typeof Text>['style']
      }
    />
  )
}
