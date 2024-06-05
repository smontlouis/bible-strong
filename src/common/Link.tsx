import React, { Component, PropsWithChildren } from 'react'
import { TouchableOpacity, Linking, Share } from 'react-native'

import Box, { BoxProps } from '~common/ui/Box'
import { StackNavigationProp } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'

// first try in typing this component
export interface LinkProps<R extends keyof MainStackProps> {
  navigation?: StackNavigationProp<MainStackProps, R>
  route?: R
  href?: string
  share?: string
  params?: MainStackProps[R]
  replace?: boolean
  onPress?: () => void
  padding?: boolean
  paddingSmall?: boolean
  style?: any
  size?: number
}
class Link extends Component<LinkProps<keyof MainStackProps>> {
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
            : navigation?.navigate(route, params) // How to type this ? Maybe we should not use a class component
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

type LinkBoxProps = React.FC<BoxProps & LinkProps<keyof MainStackProps>>
export const LinkBox = (Box.withComponent(Link) as unknown) as LinkBoxProps

// @ts-ignore
export default Link as (x: PropsWithChildren<LinkProps<keyof MainStackProps>>) => JSX.Element
