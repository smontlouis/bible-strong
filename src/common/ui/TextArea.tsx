import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import React from 'react'
import { TextInputProps } from 'react-native'

const StyledTextArea = styled.TextInput(({ theme }) => ({
  color: theme.colors.default,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  maxHeight: 200,
  minHeight: 100,
  paddingHorizontal: 15,
  paddingVertical: 30,
}))

export default (props: TextInputProps) => {
  const theme = useTheme()
  return <StyledTextArea placeholderTextColor={theme.colors.grey} multiline {...props} />
}
