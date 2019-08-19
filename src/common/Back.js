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
    return <TouchableOpacity {...this.props} onPress={this.handlePress} />
  }
}

export default compose(
  withNavigation,
  pure
)(Back)
