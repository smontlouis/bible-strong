import React, { Component, PropsWithChildren } from 'react'
import { TouchableOpacity, Linking, Share } from 'react-native'
import { withNavigation } from 'react-navigation'

import Box, { BoxProps } from '~common/ui/Box'
import { NavigationStackProp } from 'react-navigation-stack'

interface LinkProps {
  navigation?: NavigationStackProp<any, any>
  route?: string
  href?: string
  share?: string
  params?: object
  replace?: boolean
  onPress?: () => void
  padding?: boolean
  paddingSmall?: boolean
  style?: any
  size?: number
}
class Link extends Component<LinkProps> {
  handlePress = () => {
    const {
      navigation,
      route,
      href,
      share,
      params,
      replace,
      onPress,
    } = this.props
    if (route) {
      if (onPress) {
        onPress()
        setTimeout(() => {
          replace
            ? navigation?.replace(route, params)
            : navigation?.navigate(route, params)
        }, 300)

        return
      }
      replace
        ? navigation?.replace(route, params)
        : navigation?.navigate(route, params)
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
    const { padding, paddingSmall, style, size } = this.props

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
            justifyContent: 'center',
          }),
          ...(paddingSmall && {
            width: 50,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }),
          ...(size && {
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
          }),
          ...(Array.isArray(style) ? Object.assign({}, ...style) : style),
        }}
      />
    )
  }
}

type LinkBoxProps = React.FC<BoxProps & LinkProps>
export const LinkBox = (Box.withComponent(Link) as unknown) as LinkBoxProps

// @ts-ignore
export default withNavigation(Link) as (
  x: PropsWithChildren<LinkProps>
) => JSX.Element
