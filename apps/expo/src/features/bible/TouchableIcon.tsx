import * as Icon from '@expo/vector-icons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import { TouchableOpacityProps } from 'react-native'
import Text from '~common/ui/Text'

const Touchable = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.TouchableOpacity>,
    | keyof {
        noFlex?: boolean
        disabled?: boolean
      }
    | 'theme'
  > &
    Omit<
      {
        noFlex?: boolean
        disabled?: boolean
      },
      'theme'
    > & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { noFlex, disabled } = props
  const classStyles = useResolveClassNames(twMerge('items-center justify-center', className))
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [
          classStyles,
          { opacity: disabled ? 0.3 : 1, ...(!noFlex && { flex: 1 }) },
          props.style,
        ] as UIComponentProps<typeof NativeUI.TouchableOpacity>['style']
      }
    />
  )
}

const StyledIcon = (
  componentProps: Omit<
    UIComponentProps<typeof Icon.Feather>,
    | keyof {
        color?: string
        isSelected?: boolean
        disabled?: boolean
      }
    | 'theme'
  > &
    Omit<
      {
        color?: string
        isSelected?: boolean
        disabled?: boolean
      },
      'theme'
    > & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color, isSelected, disabled } = props
  const classStyles = useResolveClassNames(twMerge('', className))
  return (
    <Icon.Feather
      {...props}
      style={
        [
          classStyles,
          {
            color: disabled
              ? theme.colors.grey
              : theme.colors[color as keyof typeof theme.colors] || theme.colors.tertiary,
            ...(isSelected && {
              color: theme.colors.primary,
            }),
          },
          props.style,
        ] as UIComponentProps<typeof Icon.Feather>['style']
      }
    />
  )
}

export default ({
  onPress,
  color,
  isSelected,
  size = 20,
  noFlex = false,
  label,
  disabled,
  name,
  accessibilityLabel,
  ...props
}: {
  accessibilityLabel: string
  onPress: () => void
  color?: string
  isSelected?: boolean
  size?: number
  noFlex?: boolean
  label?: string
  disabled?: boolean
  name: keyof typeof Icon.Feather.glyphMap
} & TouchableOpacityProps) => {
  return (
    <Touchable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(isSelected) }}
      onPress={onPress}
      noFlex={noFlex}
      disabled={disabled}
      hitSlop={8}
      {...props}
    >
      <StyledIcon
        name={name}
        size={size}
        color={color}
        isSelected={isSelected}
        disabled={disabled}
      />
      {label && <Text className="mt-[5px] text-[9px] text-grey">{label}</Text>}
    </Touchable>
  )
}
