import React, { Component } from 'react'
import { pure, compose } from 'recompose'
import { TouchableOpacity, Linking, Share } from 'react-native'
import { withNavigation } from 'react-navigation'

class Link extends Component {
  props: {
    navigation: Object,
    params?: Object,
    route: string
  }

  handlePress = () => {
    const { navigation, route, href, share, params, replace, onPress } = this.props
    if (route) {
      replace ? navigation.replace(route, params) : navigation.navigate(route, params)
    }
    if (href) {
      Linking.openURL(href)
    }

    if (share) {
      Share.share({ message: share })
    }

    if (onPress) {
      onPress()
    }
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
            height: 50,
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
)(Link)
