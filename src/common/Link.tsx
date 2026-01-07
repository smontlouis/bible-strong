import React, { PropsWithChildren } from 'react'
import { Linking, Share, TouchableOpacity } from 'react-native'

import { useRouter } from 'expo-router'
import Box, { BoxProps } from '~common/ui/Box'
import { MainStackProps } from '~navigation/type'
import { routeMapping } from '~navigation/routeMapping'

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

/**
 * Serialize params for Expo Router - URL params can only be strings
 * Complex objects/arrays are JSON.stringify'd, primitives are converted to strings
 */
const serializeParams = (
  params: Record<string, any> | undefined
): Record<string, string> | undefined => {
  if (!params) return undefined

  const serialized: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'object') {
      serialized[key] = JSON.stringify(value)
    } else {
      serialized[key] = String(value)
    }
  }
  return serialized
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
  const router = useRouter()

  const handlePress = () => {
    if (route) {
      const pathname = routeMapping[route]
      const serializedParams = serializeParams(params as Record<string, any>)

      if (onPress) {
        onPress()
        setTimeout(() => {
          replace
            ? router.replace({ pathname, params: serializedParams })
            : router.push({ pathname, params: serializedParams })
        }, 300)
        return
      }

      replace
        ? router.replace({ pathname, params: serializedParams })
        : router.push({ pathname, params: serializedParams })
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
export const LinkBox = Box.withComponent(Link) as unknown as LinkBoxProps

export default Link
