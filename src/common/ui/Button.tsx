import React from 'react'
import styled from '@emotion/native'
import { ActivityIndicator, StyleProp, TouchableOpacityProps, ViewStyle } from 'react-native'
import Link, { LinkProps } from '~common/Link'

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
  theme?: Theme
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

const WrapperButton = styled.TouchableOpacity<Partial<Props>>(buttonStyles)

type ButtonLinkProps = LinkProps<keyof MainStackProps> &
  TouchableOpacityProps &
  Partial<Props> & {
    children?: React.ReactNode
  }

const ButtonLink = Link as React.ComponentType<ButtonLinkProps>

const WrapperLink = styled(ButtonLink)<Partial<Props>>(buttonStyles)

const TextButton = styled.Text(
  ({ theme, small, reverse }: { theme?: Theme; small?: boolean; reverse?: boolean }) => ({
    color: reverse ? theme?.colors.darkGrey : 'white',
    fontWeight: 'bold',
    fontSize: 16,

    ...(small && {
      fontSize: 14,
    }),
  })
)

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
}: Props) => {
  const sharedProps = {
    fullWidth,
    disabled: disabled || isLoading,
    onPress: !disabled ? onPress : () => {},
    style,
    small,
    reverse,
    secondary,
    success,
    color,
  }

  return (
    <Box flex={fullWidth ? true : undefined}>
      {onPress ? (
        <WrapperButton {...sharedProps}>
          {isLoading ? (
            <ActivityIndicator color="white" />
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
            <ActivityIndicator color="white" />
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
        <Box center marginTop={5}>
          <Text fontSize={10}>{subTitle}</Text>
        </Box>
      )}
    </Box>
  )
}

export default Button
