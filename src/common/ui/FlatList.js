import React from 'react'
import styled from '@emotion/native'
import * as Animatable from 'react-native-animatable'
import useDeviceOrientation from '~helpers/useDeviceOrientation'

const FlatList = styled.FlatList(({ theme, orientation }) => ({
  paddingBottom: 30,
  backgroundColor: theme.colors.reverse,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  maxWidth: orientation.maxWidth,
  width: '100%',
  marginLeft: 'auto',
  marginRight: 'auto',

  ...(orientation.tablet && {
    marginTop: 50,
    marginBottom: 50,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30
  })
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

export default React.forwardRef(({ ...props }, ref) => {
  const orientation = useDeviceOrientation()
  return (
    <Animatable.View style={{ flex: 1 }} animation={fadeIn} delay={300} duration={500}>
      <FlatList orientation={orientation} ref={ref} {...props} />
    </Animatable.View>
  )
})
