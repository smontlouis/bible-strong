import React, { Component } from 'react'
import { pure, compose } from 'recompose'
import { TouchableOpacity, Linking, Share } from 'react-native'
import { withNavigation } from 'react-navigation'

class Link extends Component {
  props: {
    navigation: Object,
    params?: Object,
    route: string,
  }

  handlePress = () => {
    const { navigation, route, href, share, params } = this.props
    if (route) {
      navigation.navigate(route, params)
    }
    if (href) {
      Linking.openURL(href)
    }

    if (share) {
      Share.share({ message: share })
    }
  }

  render () {
    return <TouchableOpacity {...this.props} onPress={this.handlePress} />
  }
}

export default compose(
  withNavigation,
  pure
)(Link)
