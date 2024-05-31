import React, { Component, PropsWithChildren } from 'react'
import { TouchableOpacity, Linking, Share } from 'react-native'
// import { withNavigation } from 'react-navigation'
// import { useNavigation } from '@react-navigation/native'

import Box, { BoxProps } from '~common/ui/Box'
//import { NavigationStackProp } from 'react-navigation-stack'
import { StackNavigationProp } from '@react-navigation/stack'

interface LinkProps {
  navigation?: StackNavigationProp<any, any>
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
  // navigation = useNavigation()
  navigation = this.props.navigation

  handlePress = () => {
    const {
      // navigation,
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
            ? this.navigation?.replace(route, params)
            : this.navigation?.navigate(route, params)
        }, 300)

        return
      }
      replace
        ? this.navigation?.replace(route, params)
        : this.navigation?.navigate(route, params)
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
// export default withNavigation(Link) as (
//   x: PropsWithChildren<LinkProps>
// ) => JSX.Element
export default Link as (x: PropsWithChildren<LinkProps>) => JSX.Element
