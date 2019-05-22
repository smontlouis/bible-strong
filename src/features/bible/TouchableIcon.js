import React from 'react'
import { TouchableOpacity } from 'react-native'
import { Icon } from 'expo'

import theme from '~themes/default'

export default class TabBarIcon extends React.Component {
  render () {
    const { onPress, color } = this.props
    return (
      <TouchableOpacity onPress={onPress}>
        <Icon.Feather
          name={this.props.name}
          size={20}
          color={color || theme.colors.grey}
        />
      </TouchableOpacity>
    )
  }
}
