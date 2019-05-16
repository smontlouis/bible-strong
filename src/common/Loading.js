import React from 'react'
import { ActivityIndicator } from 'react-native'
import { pure } from 'recompose'
import styled from '@emotion/native'

import Box from '~common/ui/Box'

const Container = styled.View({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center'
})

const Text = styled.Text({
  marginTop: 20
})

const Loading = ({ message = null, style, children }) => (
  <Container style={style}>
    <ActivityIndicator color={'#333'} />
    {message && <Text>{message}</Text>}
    {children && <Box width={200} marginLeft='auto' marginRight='auto'>
      { children }
    </Box>}
  </Container>
)

export default pure(Loading)
