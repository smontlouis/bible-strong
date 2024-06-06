import React from 'react'
import styled from '@emotion/native'
import { ActivityIndicator } from 'react-native'
import Link from '~common/Link'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { Theme } from '~themes'
import { StackNavigationProp } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'
import { useNavigation } from '@react-navigation/native'

interface Props {
  children: React.ReactNode
  onPress?: () => void
  route?: string
  style?: object
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
  navigation?: StackNavigationProp<MainStackProps>
}

const WrapperButton = styled.TouchableOpacity(
  ({
    theme,
    small,
    reverse,
    secondary,
    disabled,
    color,
    success,
    fullWidth,
  }: Partial<Props> & {
    theme: Theme
  }) => ({
    backgroundColor: reverse ? theme.colors.reverse : theme.colors.primary,
    borderWidth: reverse ? 1 : 0,
    borderColor: theme.colors.darkGrey,
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 15,
    paddingRight: 15,
    flexDirection: 'row',

    ...(fullWidth && { flex: 1 }),

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
)

const WrapperLink = WrapperButton.withComponent(Link)

const TextButton = styled.Text(
  ({
    theme,
    small,
    reverse,
  }: {
    theme: Theme
    small?: boolean
    reverse?: boolean
  }) => ({
    color: reverse ? theme.colors.darkGrey : 'white',
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
  navigation,
}: Props) => {
  const Component = onPress ? WrapperButton : WrapperLink

  return (
    <Box flex={fullWidth}>
      <Component
        fullWidth={fullWidth}
        disabled={disabled || isLoading}
        route={route}
        onPress={!disabled ? onPress : () => {}}
        style={style}
        small={small}
        reverse={reverse}
        secondary={secondary}
        success={success}
        color={color}
        navigation={navigation}
      >
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
      </Component>
      {subTitle && (
        <Box center marginTop={5}>
          <Text fontSize={10}>{subTitle}</Text>
        </Box>
      )}
    </Box>
  )
}

export default Button
