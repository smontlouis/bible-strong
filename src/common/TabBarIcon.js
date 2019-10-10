import React from 'react'
import * as Icon from '@expo/vector-icons'
import { withTheme } from 'emotion-theming'
import * as Animatable from 'react-native-animatable'

const AnimatableIcon = Animatable.createAnimatableComponent(Icon.Feather)

class TabBarIcon extends React.Component {
  render() {
    const { theme, component: Component } = this.props

    if (Component) {
      return (
        <Component
          size={23}
          color={this.props.focused ? theme.colors.primary : theme.colors.tertiary}
        />
      )
    }
    return (
      <AnimatableIcon
        duration={400}
        easing="ease-in-out-expo"
        name={this.props.name}
        size={23}
        color={this.props.focused ? theme.colors.primary : theme.colors.tertiary}
        transition="marginTop"
        style={{ marginTop: this.props.focused ? -8 : -3 }}
      />
    )
  }
}

export default withTheme(TabBarIcon)
