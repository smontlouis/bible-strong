import React from 'react'
import styled from '@emotion/native'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import * as Animatable from 'react-native-animatable'

const S = StyleSheet.create({
  tabButton: {
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflow: 'visible',
    // backgroundColor: 'green',
    width: 70,
    height: 40
  }
})

const Circle = styled.View(({ theme }) => ({
  position: 'absolute',
  left: 35 - 3,
  bottom: 0,
  width: 6,
  height: 6,
  borderRadius: 3,
  backgroundColor: theme.colors.primary
}))

const AnimatableCircle = Animatable.createAnimatableComponent(Circle)

const Container = styled.View(({ theme }) => ({
  flexDirection: 'row',
  // height: 60 + getBottomSpace(),
  paddingBottom: getBottomSpace(),
  backgroundColor: theme.colors.reverse,
  paddingHorizontal: 20,
  alignItems: 'flex-end',
  justifyContent: 'space-around'
}))

const TabBar = props => {
  const {
    renderIcon,
    getLabelText,
    activeTintColor,
    inactiveTintColor,
    onTabPress,
    getAccessibilityLabel,
    navigation
  } = props

  const { routes, index: activeRouteIndex } = navigation.state

  return (
    <Container>
      {routes.map((route, routeIndex) => {
        const isRouteActive = routeIndex === activeRouteIndex
        const tintColor = isRouteActive ? activeTintColor : inactiveTintColor

        return (
          <TouchableOpacity
            key={routeIndex}
            style={S.tabButton}
            onPress={() => {
              onTabPress({ route })
            }}
            accessibilityLabel={getAccessibilityLabel({ route })}>
            {renderIcon({ route, focused: isRouteActive, tintColor })}
            <AnimatableCircle transition="bottom" style={{ bottom: isRouteActive ? 8 : -100 }} />
          </TouchableOpacity>
        )
      })}
    </Container>
  )
}

export default TabBar
