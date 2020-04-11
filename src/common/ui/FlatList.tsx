import React from 'react'
import styled from '@emotion/native'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import * as Animatable from 'react-native-animatable'
import useDeviceOrientation from '~helpers/useDeviceOrientation'

const FlatList = styled.FlatList(({ theme, orientation, bg }) => ({
  paddingBottom: 30,
  backgroundColor: theme.colors[bg] || theme.colors.reverse,
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

const AnimatedFlatList = React.forwardRef(
  ({ contentContainerStyle, ...props }, ref) => {
    const orientation = useDeviceOrientation()
    return (
      <Animatable.View
        style={{ flex: 1 }}
        animation={fadeIn}
        delay={300}
        duration={500}
      >
        <FlatList
          orientation={orientation}
          contentContainerStyle={{
            paddingTop: 20,
            paddingBottom: 10 + getBottomSpace(),
            ...contentContainerStyle,
          }}
          ref={ref}
          {...props}
        />
      </Animatable.View>
    )
  }
)

export default AnimatedFlatList
