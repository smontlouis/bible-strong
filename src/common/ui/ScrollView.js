import React from 'react'
import styled from '@emotion/native'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import * as Animatable from 'react-native-animatable'

import useDeviceOrientation from '~helpers/useDeviceOrientation'

const ScrollView = styled.ScrollView(({ theme, orientation }) => ({
  backgroundColor: theme.colors.reverse,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  maxWidth: orientation.maxWidth,
  marginLeft: 'auto',
  marginRight: 'auto',
  width: '100%',

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

export const HomeScrollView = ({ children, contentContainerStyle, ...props }) => {
  const orientation = useDeviceOrientation()
  return (
    <ScrollView
      {...props}
      orientation={orientation}
      contentContainerStyle={{
        paddingTop: 20,
        paddingBottom: 20,
        ...contentContainerStyle
      }}>
      {children}
    </ScrollView>
  )
}

export default ({ children, contentContainerStyle, ...props }) => {
  const orientation = useDeviceOrientation()
  return (
    <Animatable.View style={{ flex: 1 }} animation={fadeIn} delay={300} duration={500}>
      <ScrollView
        {...props}
        orientation={orientation}
        contentContainerStyle={{
          paddingTop: 20,
          paddingBottom: 10 + getBottomSpace(),
          ...contentContainerStyle
        }}>
        {children}
      </ScrollView>
    </Animatable.View>
  )
}
