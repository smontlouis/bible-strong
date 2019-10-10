import React from 'react'
import styled from '@emotion/native'
import * as Animatable from 'react-native-animatable'

const SectionList = styled.SectionList(({ theme }) => ({
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
  <Animatable.View style={{ flex: 1 }} animation={fadeIn} delay={100} duration={500}>
    <SectionList ref={ref} {...props} />
  </Animatable.View>
))
