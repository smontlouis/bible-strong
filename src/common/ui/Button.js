import React from 'react'
import styled from '@emotion/native'
import { ActivityIndicator } from 'react-native'

const WrapperButton = styled.TouchableOpacity(({ theme, small, reverse, type, disabled }) => ({
  backgroundColor: reverse ? theme.colors.reverse : theme.colors.primary,
  borderWidth: reverse ? 1 : 0,
  borderColor: theme.colors.darkGrey,
  borderRadius: 3,
  height: 40,
  alignItems: 'center',
  justifyContent: 'center',
  paddingLeft: 10,
  paddingRight: 10,

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
}))

const TextButton = styled.Text(({ theme, small, reverse }) => ({
  color: reverse ? theme.colors.darkGrey : theme.colors.reverse,
  fontWeight: 'bold',
  fontSize: 16,

  ...(small && {
    fontSize: 14
  })
}))

const Button = ({ title, onPress, style, small, reverse, disabled, type, isLoading }) => (
  <WrapperButton
    disabled={disabled || isLoading}
    onPress={!disabled ? onPress : () => {}}
    style={style}
    small={small}
    reverse={reverse}
    type={type}>
    {isLoading ? (
      <ActivityIndicator color="white" />
    ) : (
      <TextButton small={small} reverse={reverse}>
        {title}
      </TextButton>
    )}
  </WrapperButton>
)

export default Button
