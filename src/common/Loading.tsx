import React from 'react'
import { ActivityIndicator } from 'react-native'
import { useTheme } from '@emotion/react'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import useTimeout from '~helpers/useTimeout'
import styled from '@emotion/native'
import { Theme } from '~themes'

const Container = styled.View(({ theme }) => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
}))

interface Props {
  message?: string
  subMessage?: string
  style?: Object
  children?: React.ReactNode
}

const Loading = ({ message, subMessage, style, children }: Props) => {
  const [isReady] = useTimeout(3000)
  const theme: Theme = useTheme()

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
        <Box width={200} marginLeft="auto" marginRight="auto" marginTop={10}>
          {children}
        </Box>
      )}
    </Container>
  )
}

export default Loading
