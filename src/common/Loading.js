import React from 'react'
import { ActivityIndicator } from 'react-native'
import { pure } from 'recompose'
import styled from '@emotion/native'

const Container = styled.View({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center'
})

const Text = styled.Text({
  marginTop: 20
})

const Loading = ({ message = null }) => (
  <Container>
    <ActivityIndicator />
    {message && <Text>{message}</Text>}
  </Container>
)

export default pure(Loading)
