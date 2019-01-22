import React, { Component } from 'react'
import { pure, compose } from 'recompose'
import { TouchableOpacity } from 'react-native'
import { withNavigation } from 'react-navigation'

class Link extends Component {
  props: {
    navigation: Object,
    params?: Object,
    route: string,
  }

  handlePress = () => {
    const { navigation, route, params } = this.props
    navigation.navigate(route, params)
  }

  render () {
    return <TouchableOpacity {...this.props} onPress={this.handlePress} />
  }
}

export default compose(
  withNavigation,
  pure
)(Link)
