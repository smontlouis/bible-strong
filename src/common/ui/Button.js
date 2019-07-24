import React from 'react'
import styled from '@emotion/native'

const WrapperButton = styled.TouchableOpacity(({ theme, small, reverse, type }) => ({
  backgroundColor: reverse ? theme.colors.reverse : theme.colors.primary,
  borderWidth: reverse ? 1 : 0,
  borderColor: theme.colors.darkGrey,
  borderRadius: 5,
  height: 40,
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 20,
  marginRight: 20,
  paddingLeft: 10,
  paddingRight: 10,

  ...small && {
    height: 30,
    minWidth: 100,
    paddingLeft: 5,
    paddingRight: 5,
    marginRight: 0,
    marginLeft: 0
  },
  ...type === 'secondary' && {

  }
}))

const TextButton = styled.Text(({ theme, small, reverse }) => ({
  color: reverse ? theme.colors.darkGrey : theme.colors.reverse,
  fontWeight: 'bold',
  fontSize: 16,

  ...small && {
    fontSize: 14
  }
}))

const Button = ({ title, onPress, style, small, reverse, disabled, type }) => (
  <WrapperButton onPress={!disabled ? onPress : () => {}} style={style} small={small} reverse={reverse} type={type}>
    <TextButton small={small} reverse={reverse}>{title}</TextButton>
  </WrapperButton>
)

export default Button
