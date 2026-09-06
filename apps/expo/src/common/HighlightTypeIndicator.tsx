import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import { View } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import Text from '~common/ui/Text'
import type { HighlightType } from '~redux/modules/user'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme, useTheme } from '~themes/ThemeProvider'

const Touchable = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('items-center justify-center', className))
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [classStyles, {}, props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
      }
    />
  )
}

const CircleContainer = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.View>,
    keyof { color: string; size: number; isSelected?: boolean } | 'theme'
  > &
    Omit<{ color: string; size: number; isSelected?: boolean }, 'theme'> & {
      theme?: AppTheme
      className?: string
    }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color, size, isSelected } = props
  const classStyles = useResolveClassNames(twMerge('overflow-visible', className))
  return (
    <NativeUI.View
      {...props}
      style={
        [
          classStyles,
          {
            width: size,
            height: size,
            borderRadius: size / 3,
            backgroundColor: color,
            transitionProperty: 'boxShadow',
            transitionDuration: 300,
            ...(isSelected && {
              boxShadow: `0 0 0 3px ${theme.colors.reverse}, 0 0 0 5px ${theme.colors.primary}`,
            }),
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.View>['style']
      }
    />
  )
}

const TextContainer = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.View>,
    keyof { size: number; isSelected?: boolean } | 'theme'
  > &
    Omit<{ size: number; isSelected?: boolean }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { size, isSelected } = props
  const classStyles = useResolveClassNames(twMerge('items-center justify-center', className))
  return (
    <NativeUI.View
      {...props}
      style={
        [
          classStyles,
          {
            width: size,
            height: size,
            boxShadow: 'inset 0 0 2px 0 rgba(0, 0, 0, 0.15)',
            transitionProperty: 'boxShadow',
            transitionDuration: 300,
            borderRadius: size / 3,
            ...(isSelected && {
              boxShadow: `inset 0 0 2px 0 rgba(0, 0, 0, 0.15), 0 0 0 2px ${theme.colors.reverse}, 0 0 0 4px ${theme.colors.primary}`,
            }),
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.View>['style']
      }
    />
  )
}

type Props = {
  accessibilityLabel?: string
  color: string
  type?: HighlightType
  size?: number
  onPress?: () => void
  onLongPress?: () => void
  disabled?: boolean
  isSelected?: boolean
}

const HighlightTypeIndicator = ({
  accessibilityLabel,
  color,
  type = 'background',
  size = 30,
  onPress,
  onLongPress,
  disabled = false,
  isSelected = false,
}: Props) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const fontSize = size * 0.85

  const renderIndicator = () => {
    switch (type) {
      case 'textColor':
        return (
          <TextContainer size={size} isSelected={isSelected}>
            <Text
              style={{
                fontSize,
                fontWeight: 'bold',
                color: color,
              }}
            >
              A
            </Text>
          </TextContainer>
        )

      case 'underline':
        return (
          <TextContainer size={size} isSelected={isSelected}>
            <Text
              style={{
                fontSize,
                fontWeight: 'bold',
                color: theme.colors.darkGrey,
                opacity: 0.6,
              }}
            >
              A
            </Text>
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: size * 0.15,
                right: size * 0.15,
                height: size * 0.2,
                borderWidth: size * 0.05,
                borderColor: theme.colors.reverse,
                backgroundColor: color,
                borderRadius: size * 0.3,
              }}
            />
          </TextContainer>
        )

      case 'background':
      default:
        return <CircleContainer color={color} size={size} isSelected={isSelected} />
    }
  }

  if (onPress || onLongPress) {
    return (
      <Touchable
        accessibilityActions={
          onLongPress ? [{ name: 'edit', label: t('accessibility.editColor') }] : undefined
        }
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected: isSelected }}
        activeOpacity={0.7}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        hitSlop={10}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'edit') {
            onLongPress?.()
          }
        }}
      >
        {renderIndicator()}
      </Touchable>
    )
  }

  return renderIndicator()
}

export default HighlightTypeIndicator
