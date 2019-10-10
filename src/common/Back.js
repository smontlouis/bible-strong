// @flow
import React, { Component } from 'react'
import { pure, compose } from 'recompose'
import { TouchableOpacity } from 'react-native'
import { withNavigation } from 'react-navigation'

class Back extends Component {
  handlePress = () => {
    const { navigation } = this.props
    navigation.goBack()
  }

  render() {
    const { padding, style } = this.props

    return (
      <TouchableOpacity
        {...this.props}
        onPress={this.handlePress}
        style={{
          ...style,
          ...(padding && {
            width: 60,
            height: 60,
            alignItems: 'center',
            justifyContent: 'center'
          })
        }}
      />
    )
  }
}

export default compose(
  withNavigation,
  pure
)(Back)
