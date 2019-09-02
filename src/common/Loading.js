import React, { useState } from 'react'
import { ActivityIndicator } from 'react-native'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import useTimeout from '~helpers/useTimeout'

const Container = styled.View(({ theme }) => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.colors.reverse
}))

const Loading = ({ message = null, subMessage = null, style, children, theme }) => {
  const [isReady] = useTimeout(3000)

  return (
    <Container style={style}>
      <ActivityIndicator color={theme.colors.grey} />
      {message && (
        <Box>
          <Text marginTop={20}>{message}</Text>
        </Box>
      )}
      {subMessage && isReady() && (
        <Box paddingLeft={30} paddingRight={30}>
          <Text textAlign="center" marginTop={5} fontSize={12}>
            {subMessage}
          </Text>
        </Box>
      )}
      {children && (
        <Box width={200} marginLeft="auto" marginRight="auto">
          {children}
        </Box>
      )}
    </Container>
  )
}

export default withTheme(Loading)
