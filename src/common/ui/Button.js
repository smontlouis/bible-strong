import React from 'react'
import styled from '@emotion/native'
import { ActivityIndicator } from 'react-native'
import Link from '~common/Link'

const WrapperButton = styled.TouchableOpacity(
  ({ theme, small, reverse, secondary, type, disabled, color }) => ({
    backgroundColor: reverse ? theme.colors.reverse : theme.colors.primary,
    borderWidth: reverse ? 1 : 0,
    borderColor: theme.colors.darkGrey,
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 10,
    paddingRight: 10,
    flexDirection: 'row',

    ...(color && { backgroundColor: color }),

    ...(secondary && { backgroundColor: theme.colors.secondary }),

    ...(disabled && {
      opacity: 0.5
    }),

    ...(small && {
      height: 30,
      minWidth: 100,
      paddingLeft: 5,
      paddingRight: 5,
      marginRight: 0,
      marginLeft: 0
    }),
    ...(type === 'secondary' && {})
  })
)

const WrapperLink = WrapperButton.withComponent(Link)

const TextButton = styled.Text(({ theme, small, reverse }) => ({
  color: reverse ? theme.colors.darkGrey : theme.colors.reverse,
  fontWeight: 'bold',
  fontSize: 16,

  ...(small && {
    fontSize: 14
  })
}))

const Button = ({
  title,
  onPress,
  route,
  style,
  small,
  reverse,
  disabled,
  type,
  isLoading,
  leftIcon,
  rightIcon,
  secondary,
  color
}) => {
  const Component = onPress ? WrapperButton : WrapperLink

  return (
    <Component
      disabled={disabled || isLoading}
      route={route}
      onPress={!disabled ? onPress : () => {}}
      style={style}
      small={small}
      reverse={reverse}
      secondary={secondary}
      color={color}
      type={type}>
      {isLoading ? (
        <ActivityIndicator color="white" />
      ) : (
        <>
          {leftIcon}
          <TextButton small={small} reverse={reverse}>
            {title}
          </TextButton>
          {rightIcon}
        </>
      )}
    </Component>
  )
}

export default Button
