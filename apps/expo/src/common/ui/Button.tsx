import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import * as NativeUI from 'react-native'
import {
  AccessibilityState,
  ActivityIndicator,
  StyleProp,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native'
import { twMerge } from '~common/ui/classNames'

import Link, { LinkProps } from '~common/Link'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { MainStackProps } from '~navigation/type'
import { Theme } from '~themes'

interface Props {
  children: React.ReactNode
  onPress?: () => void
  route?: keyof MainStackProps
  style?: StyleProp<ViewStyle>
  small?: boolean
  reverse?: boolean
  secondary?: boolean
  success?: boolean
  color?: string
  fullWidth?: boolean
  disabled?: boolean
  isLoading?: boolean
  leftIcon?: JSX.Element
  rightIcon?: JSX.Element
  subTitle?: string
  testID?: string
  theme?: Theme
  accessibilityHint?: string
  accessibilityLabel?: string
  accessibilityRole?: TouchableOpacityProps['accessibilityRole']
  accessibilityState?: AccessibilityState
}

type WrapperButtonProps = Partial<Props> & {
  theme: Theme
}

const buttonStyles = ({
  theme,
  small,
  reverse,
  secondary,
  disabled,
  color,
  success,
  fullWidth,
}: WrapperButtonProps): ViewStyle => ({
  backgroundColor: reverse ? theme.colors.reverse : theme.colors.primary,
  borderWidth: reverse ? 1 : 0,
  borderColor: theme.colors.border,
  borderRadius: 24,
  height: 48,
  alignItems: 'center',
  justifyContent: 'center',
  paddingLeft: 15,
  paddingRight: 15,
  flexDirection: 'row',

  ...(fullWidth && {}),

  ...(color && { backgroundColor: color }),

  ...(secondary && { backgroundColor: theme.colors.secondary }),
  ...(success && { backgroundColor: theme.colors.success }),

  ...(disabled && {
    opacity: 0.5,
  }),

  ...(small && {
    height: 30,
    minWidth: 100,
    paddingLeft: 5,
    paddingRight: 5,
    marginRight: 0,
    marginLeft: 0,
  }),
})

const WrapperButton = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.TouchableOpacity>,
    keyof Partial<Props> | 'theme'
  > &
    Omit<Partial<Props>, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme

  const resolvedClassName = twMerge('', className)
  return (
    <NativeUI.TouchableOpacity
      {...props}
      className={resolvedClassName}
      style={
        [buttonStyles({ ...props, theme }), props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
      }
    />
  )
}

type ButtonLinkProps = LinkProps<keyof MainStackProps> &
  TouchableOpacityProps &
  Partial<Props> & {
    children?: React.ReactNode
  }

const ButtonLink = Link as React.ComponentType<ButtonLinkProps>

const WrapperLink = (
  componentProps: Omit<UIComponentProps<typeof ButtonLink>, keyof Partial<Props> | 'theme'> &
    Omit<Partial<Props>, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme

  const resolvedClassName = twMerge('', className)
  return (
    <ButtonLink
      {...props}
      className={resolvedClassName}
      style={
        [buttonStyles({ ...props, theme }), props.style] as UIComponentProps<
          typeof ButtonLink
        >['style']
      }
    />
  )
}

const TextButton = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.Text>,
    keyof { theme?: Theme; small?: boolean; reverse?: boolean } | 'theme'
  > &
    Omit<{ theme?: Theme; small?: boolean; reverse?: boolean }, 'theme'> & {
      theme?: AppTheme
      className?: string
    }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { small, reverse } = props
  const resolvedClassName = twMerge('font-bold text-[16px]', className)
  return (
    <Text
      {...props}
      className={resolvedClassName}
      style={
        [
          {
            color: reverse ? theme?.colors.default : 'white',
            ...(small && {
              fontSize: 14,
            }),
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.Text>['style']
      }
    />
  )
}

const Button = ({
  children,
  onPress,
  route,
  style,
  small,
  reverse,
  disabled,
  isLoading,
  leftIcon,
  rightIcon,
  secondary,
  success,
  color,
  subTitle,
  fullWidth,
  testID,
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
}: Props) => {
  const textLabel =
    typeof children === 'string' || typeof children === 'number' ? String(children) : undefined
  const sharedProps = {
    fullWidth,
    disabled: disabled || isLoading,
    onPress: !disabled && !isLoading ? onPress : () => {},
    style,
    small,
    reverse,
    secondary,
    success,
    color,
    testID,
    accessibilityHint,
    accessibilityLabel: accessibilityLabel ?? textLabel,
    accessibilityRole: accessibilityRole ?? (route ? 'link' : 'button'),
    accessibilityState: {
      ...accessibilityState,
      disabled: Boolean(disabled || isLoading || accessibilityState?.disabled),
      busy: Boolean(isLoading || accessibilityState?.busy),
    },
  }

  return (
    <Box className="overflow-hidden border-continuous">
      {onPress ? (
        <WrapperButton {...sharedProps}>
          {isLoading ? (
            <ActivityIndicator accessible={false} color="white" />
          ) : (
            <>
              {leftIcon}
              <TextButton small={small} reverse={reverse}>
                {children}
              </TextButton>
              {rightIcon}
            </>
          )}
        </WrapperButton>
      ) : (
        <WrapperLink {...sharedProps} route={route}>
          {isLoading ? (
            <ActivityIndicator accessible={false} color="white" />
          ) : (
            <>
              {leftIcon}
              <TextButton small={small} reverse={reverse}>
                {children}
              </TextButton>
              {rightIcon}
            </>
          )}
        </WrapperLink>
      )}
      {subTitle && (
        <Box className="overflow-hidden border-continuous items-center justify-center mt-[5px]">
          <Text className="text-[10px]">{subTitle}</Text>
        </Box>
      )}
    </Box>
  )
}

export default Button
