import React from 'react'
import styled from '@emotion/native'
import Box from '~common/ui/Box'

const TextInput = styled.TextInput(({ theme, noBorder, leftIcon }) => ({
  color: theme.colors.default,
  paddingBottom: 10,
  marginTop: 10,
  ...(!noBorder && {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 2
  }),
  ...(leftIcon && {
    paddingLeft: 30
  })
}))

const LeftIcon = styled(Box)(() => ({
  position: 'absolute',
  left: 0,
  bottom: 13
}))

export default props => (
  <Box position="relative">
    {props.leftIcon && <LeftIcon>{props.leftIcon}</LeftIcon>}
    <TextInput {...props} />
  </Box>
)
