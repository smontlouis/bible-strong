import React from 'react'
import styled from '@emotion/native'
import * as Animatable from 'react-native-animatable'

const FlatList = styled.FlatList(({ theme }) => ({
  paddingBottom: 30,
  backgroundColor: theme.colors.reverse,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30
}))

const fadeIn = {
  from: {
    translateY: 10,
    opacity: 0
  },
  to: {
    translateY: 0,
    opacity: 1
  }
}

export default React.forwardRef((props, ref) => (
  <Animatable.View style={{ flex: 1 }} animation={fadeIn} delay={300} duration={500}>
    <FlatList ref={ref} {...props} />
  </Animatable.View>
))
