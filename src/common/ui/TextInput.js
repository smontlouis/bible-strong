import React from 'react'
import styled from '@emotion/native'
import { withTheme } from '@emotion/react'
import Box from '~common/ui/Box'

const TextInput = styled.TextInput(({ theme, leftIcon }) => ({
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

export default withTheme(props => (
  <Box position="relative">
    {props.leftIcon && <LeftIcon>{props.leftIcon}</LeftIcon>}
    <TextInput placeholderTextColor={props.theme.colors.grey} {...props} />
  </Box>
))
