import React from 'react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { withTheme } from 'emotion-theming'
import { useSelector } from 'react-redux'
import * as Animatable from 'react-native-animatable'

import useDeviceOrientation from '~helpers/useDeviceOrientation'

const Circle = styled.View(({ theme }) => ({
  position: 'absolute',
  width: 10,
  height: 10,
  borderRadius: 10,
  top: 0,
  right: -3,
  backgroundColor: theme.colors.success
}))

const AnimatedCircle = Animatable.createAnimatableComponent(Circle)

const TabBarIcon = props => {
  const { theme, component: Component } = props
  const orientation = useDeviceOrientation()
  const hasUpdate = useSelector(state =>
    Object.values(state.user.needsUpdate).some(v => v)
  )

  if (Component) {
    return (
      <Component
        size={23}
        color={props.focused ? theme.colors.primary : theme.colors.tertiary}
      />
    )
  }
  return (
    <Animatable.View
      style={{
        position: 'relative',
        ...(orientation.portrait
          ? { marginTop: props.focused ? -8 : -3 }
          : { marginLeft: props.focused ? 8 : 0 })
      }}
      duration={400}
      easing="ease-in-out-expo"
      transition={orientation.portrait ? 'marginTop' : 'marginLeft'}>
      <Icon.Feather
        name={props.name}
        size={23}
        color={props.focused ? theme.colors.primary : theme.colors.tertiary}
      />
      {props.name === 'menu' && hasUpdate && (
        <AnimatedCircle
          animation="pulse"
          easing="ease-out"
          iterationCount="infinite"
        />
      )}
    </Animatable.View>
  )
}

export default withTheme(TabBarIcon)
