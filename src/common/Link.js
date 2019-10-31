import React, { Component } from 'react'
import { pure, compose } from 'recompose'
import { TouchableOpacity, Linking, Share } from 'react-native'
import { withNavigation } from 'react-navigation'

class Link extends Component {
  handlePress = () => {
    const { navigation, route, href, share, params, replace, onPress } = this.props
    if (route) {
      if (onPress) {
        onPress()
        setTimeout(() => {
          replace ? navigation.replace(route, params) : navigation.navigate(route, params)
        }, 300)

        return
      }
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
    const { padding, paddingSmall, style } = this.props
    return (
      <TouchableOpacity
        activeOpacity={0.5}
        {...this.props}
        onPress={this.handlePress}
        style={{
          ...(padding && {
            width: 60,
            height: 60,
            alignItems: 'center',
            justifyContent: 'center'
          }),
          ...(paddingSmall && {
            width: 50,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center'
          }),
          ...style
        }}
      />
    )
  }
}

export default compose(
  withNavigation,
  pure
)(Link)
