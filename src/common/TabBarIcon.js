import React from 'react'
import * as Icon from '@expo/vector-icons'
import { withTheme } from 'emotion-theming'
import * as Animatable from 'react-native-animatable'

import useDeviceOrientation from '~helpers/useDeviceOrientation'

const AnimatableIcon = Animatable.createAnimatableComponent(Icon.Feather)

const TabBarIcon = props => {
  const { theme, component: Component } = props
  const orientation = useDeviceOrientation()

  if (Component) {
    return (
      <Component size={23} color={props.focused ? theme.colors.primary : theme.colors.tertiary} />
    )
  }
  return (
    <AnimatableIcon
      duration={400}
      easing="ease-in-out-expo"
      name={props.name}
      size={23}
      color={props.focused ? theme.colors.primary : theme.colors.tertiary}
      transition={orientation.portrait ? 'marginTop' : 'marginLeft'}
      style={
        orientation.portrait
          ? { marginTop: props.focused ? -8 : -3 }
          : { marginLeft: props.focused ? 8 : 0 }
      }
    />
  )
}

export default withTheme(TabBarIcon)
