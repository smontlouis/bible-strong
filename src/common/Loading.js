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

const Loading = ({ message = null, children }) => (
  <Container>
    <ActivityIndicator />
    {message && <Text>{message}</Text>}
    <Box width={200} marginLeft='auto' marginRight='auto'>
      { children }
    </Box>
  </Container>
)

export default pure(Loading)
