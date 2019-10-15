import React from 'react'
import styled from '@emotion/native'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import * as Animatable from 'react-native-animatable'

const TouchableTab = styled.TouchableOpacity(({ orientation }) => ({
  position: 'relative',
  justifyContent: 'flex-start',
  alignItems: 'center',
  width: 70,
  height: 40,
  overflow: 'visible',

  ...(orientation.landscape && {
    width: 50,
    height: 50,
    justifyContent: 'center'
  })
}))

const Circle = styled.View(({ theme, orientation }) => ({
  position: 'absolute',

  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: theme.colors.primary,

  ...(orientation.landscape && {
    bottom: 20
  }),

  ...(orientation.portrait && {
    left: 35 - 3
  })
}))

const AnimatableCircle = Animatable.createAnimatableComponent(Circle)

const Container = styled.View(({ theme, orientation }) => ({
  flexDirection: 'row',
  overflow: 'visible',
  paddingBottom: getBottomSpace(),
  backgroundColor: theme.colors.reverse,
  paddingHorizontal: 20,
  alignItems: 'flex-end',
  justifyContent: 'space-around',

  ...(orientation.landscape && {
    overflow: 'hidden',
    flexDirection: 'column',
    paddingHorizontal: 10
  })
}))

const TabBar = props => {
  const {
    renderIcon,
    getLabelText,
    activeTintColor,
    inactiveTintColor,
    onTabPress,
    getAccessibilityLabel,
    navigation,
    orientation
  } = props

  const { routes, index: activeRouteIndex } = navigation.state

  return (
    <Container orientation={orientation}>
      {routes.map((route, routeIndex) => {
        const isRouteActive = routeIndex === activeRouteIndex
        const tintColor = isRouteActive ? activeTintColor : inactiveTintColor

        return (
          <TouchableTab
            key={routeIndex}
            orientation={orientation}
            onPress={() => {
              onTabPress({ route })
            }}
            accessibilityLabel={getAccessibilityLabel({ route })}>
            {renderIcon({ route, focused: isRouteActive, tintColor })}
            {orientation.portrait ? (
              <AnimatableCircle
                orientation={orientation}
                transition="bottom"
                style={{ bottom: isRouteActive ? 8 : -100 }}
              />
            ) : (
              <AnimatableCircle
                orientation={orientation}
                transition="left"
                style={{ left: isRouteActive ? 3 : -100 }}
              />
            )}
          </TouchableTab>
        )
      })}
    </Container>
  )
}

export default TabBar
