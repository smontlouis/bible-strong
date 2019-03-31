import React from 'react'
import styled from '@emotion/native'
import { TouchableOpacity } from 'react-native'

const WrapperButton = styled.View(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  borderRadius: 5,
  height: 40,
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 20,
  marginRight: 20
}))

const TextButton = styled.Text(({ theme }) => ({
  color: theme.colors.reverse,
  fontWeight: 'bold',
  fontSize: 16
}))

const Button = ({ title, onPress, style }) => (
  <TouchableOpacity onPress={onPress}>
    <WrapperButton style={style}>
      <TextButton>{title}</TextButton>
    </WrapperButton>
  </TouchableOpacity>
)

export default Button
