import React from 'react'
import styled from '@emotion/native'
import { withTheme } from '@emotion/react'
import Box from '~common/ui/Box'

const TextInput = styled.TextInput(({ theme, noBorder, leftIcon }) => ({
  color: theme.colors.default,
  paddingBottom: 10,
  marginTop: 10,
  ...(!noBorder && {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 2,
  }),
  ...(leftIcon && {
    paddingLeft: 30,
  }),
}))

const LeftIcon = styled(Box)(() => ({
  position: 'absolute',
  left: 0,
  bottom: 13,
}))

export default withTheme(props => (
  <Box position="relative">
    {props.leftIcon && <LeftIcon>{props.leftIcon}</LeftIcon>}
    <TextInput
      placeholderTextColor={
        props.placeholderTextColor || props.theme.colors.default
      }
      {...props}
    />
  </Box>
))
