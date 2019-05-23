import React from 'react'
import { ActivityIndicator } from 'react-native'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const Container = styled.View(({ theme }) => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.colors.reverse
}))

const Loading = ({ message = null, style, children, theme }) => (
  <Container style={style}>
    <ActivityIndicator color={theme.colors.grey} />
    {message && <Text marginTop={20}>{message}</Text>}
    {children && <Box width={200} marginLeft='auto' marginRight='auto'>
      { children }
    </Box>}
  </Container>
)

export default withTheme(Loading)
