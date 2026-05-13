import React from 'react'
import styled from '@emotion/native'
import { withTheme } from '@emotion/react'
import Box from '~common/ui/Box'
import { Theme } from '~themes'
import { TextInputProps as RNTextInputProps } from 'react-native'

interface StyledTextInputProps {
  leftIcon?: React.ReactNode
}

const StyledTextInput = styled.TextInput<StyledTextInputProps>(({ theme, leftIcon }) => ({
  color: theme.colors.default,
  height: 48,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  paddingLeft: leftIcon ? 45 : 15,
}))

const LeftIcon = styled(Box)(() => ({
  position: 'absolute',
  left: 15,
  bottom: 13,
}))

interface TextInputWrapperProps extends RNTextInputProps {
  theme: Theme
  leftIcon?: React.ReactNode
}

export default withTheme((props: TextInputWrapperProps) => (
  <Box position="relative">
    {props.leftIcon && <LeftIcon>{props.leftIcon}</LeftIcon>}
    <StyledTextInput placeholderTextColor={props.theme.colors.grey} {...props} />
  </Box>
))
