import React from 'react'
import { View } from 'react-native'
import styled from '@emotion/native'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import * as Animatable from 'react-native-animatable'
import useDeviceOrientation from '~helpers/useDeviceOrientation'

const SectionList = styled.SectionList(({ theme, orientation }) => ({
  paddingBottom: 30,
  backgroundColor: theme.colors.reverse,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  maxWidth: orientation.maxWidth,
  width: '100%',
  marginLeft: 'auto',
  marginRight: 'auto',

  ...(orientation.tablet && {
    marginTop: 20,
    marginBottom: 50,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  }),
}))

const fadeIn = {
  from: {
    translateY: 10,
    opacity: 0,
  },
  to: {
    translateY: 0,
    opacity: 1,
  },
}

export default React.forwardRef(({ contentContainerStyle, ...props }, ref) => {
  const orientation = useDeviceOrientation()

  return (
    <View style={{ flex: 1 }} animation={fadeIn} delay={100} duration={500}>
      <SectionList
        orientation={orientation}
        contentContainerStyle={{
          paddingTop: 20,
          paddingBottom: 10 + getBottomSpace(),
          ...contentContainerStyle,
        }}
        ref={ref}
        {...props}
      />
    </View>
  )
})
