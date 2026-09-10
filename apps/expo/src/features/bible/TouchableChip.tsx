import * as Icon from '@expo/vector-icons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme, Theme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import Text from '~common/ui/Text'

const Touchable = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { disabled } = props
  const resolvedClassName = twMerge(
    'flex-row items-center justify-center mr-[10px] bg-light-primary h-[30px] px-[10px] rounded-[20px]',
    className
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      className={resolvedClassName}
      style={
        [{ opacity: disabled ? 0.3 : 1 }, props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
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
        theme?: Theme
      }
    | 'theme'
  > &
    Omit<
      {
        color?: string
        isSelected?: boolean
        disabled?: boolean
        theme?: Theme
      },
      'theme'
    > & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color, isSelected, disabled } = props
  const resolvedClassName = twMerge('mr-[8px]', className)
  return (
    <Icon.Feather
      {...props}
      className={resolvedClassName}
      style={
        [
          {
            color: disabled
              ? theme.colors.grey
              : theme.colors[color as keyof Theme['colors']] || color || theme.colors.primary,
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

type Props = {
  onPress: () => void
  color?: string
  isSelected?: boolean
  size?: number
  label?: string
  disabled?: boolean
  name?: keyof typeof Icon.Feather.glyphMap
}

export default ({ onPress, color, isSelected, size = 17, label, disabled, name }: Props) => {
  return (
    <Touchable onPress={onPress} disabled={disabled}>
      {name && (
        <StyledIcon
          name={name}
          size={size}
          color={color}
          isSelected={isSelected}
          disabled={disabled}
        />
      )}
      {label && <Text className="text-[13px] text-primary">{label}</Text>}
    </Touchable>
  )
}
