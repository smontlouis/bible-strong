import React, { PropsWithChildren } from 'react'
import { Linking, Share, TouchableOpacity } from 'react-native'

import { StackActions, useNavigation } from '@react-navigation/native'
import Box, { BoxProps } from '~common/ui/Box'
import { MainStackProps } from '~navigation/type'

export interface LinkProps<R extends keyof MainStackProps> {
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

const Link = <R extends keyof MainStackProps>({
  route,
  href,
  share,
  params,
  replace,
  onPress,
  padding,
  paddingSmall,
  style,
  size,
  ...props
}: PropsWithChildren<LinkProps<R>>) => {
  const navigation = useNavigation()

  const handlePress = () => {
    if (route) {
      if (onPress) {
        onPress()
        setTimeout(() => {
          replace
            ? navigation.dispatch(StackActions.replace(route, params))
            : navigation.dispatch(StackActions.push(route, params))
        }, 300)
        return
      }

      replace
        ? navigation.dispatch(StackActions.replace(route, params))
        : navigation.dispatch(StackActions.push(route, params))
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

  return (
    <TouchableOpacity
      activeOpacity={0.5}
      {...props}
      onPress={handlePress}
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

type LinkBoxProps = React.FC<BoxProps & LinkProps<keyof MainStackProps>>
export const LinkBox = (Box.withComponent(Link) as unknown) as LinkBoxProps

export default Link
