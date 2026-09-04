import React from 'react'
import { Platform } from 'react-native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const AVATAR_COLORS = ['#2F6FDB', '#147D82', '#7652A7', '#A45D79', '#A56532'] as const

const hash = (value: string) =>
  [...value].reduce((result, character) => result + character.charCodeAt(0), 0)

export const getCommentaryInitials = (author: string, fallback: string) => {
  if (/ellen g\. white/iu.test(author)) return 'EGW'

  const compactFallback = fallback.replace(/[^\p{L}\p{N}]/gu, '')
  if (/^[\p{Lu}\p{N}]{2,4}$/u.test(compactFallback)) return compactFallback

  const words = author
    .replace(/\([^)]*\)/gu, '')
    .split(/[\s,&–—-]+/u)
    .map(word => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)

  if (words.length >= 2) return `${words[0][0]}${words.at(-1)?.[0]}`.toLocaleUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase()
  return fallback.slice(0, 2).toLocaleUpperCase()
}

type Props = {
  resourceCode: string
  author: string
  fallback: string
  size?: number
  muted?: boolean
  outlined?: boolean
}

const CommentaryAvatar = ({
  resourceCode,
  author,
  fallback,
  size = 44,
  muted = false,
  outlined = false,
}: Props) => {
  const backgroundColor = AVATAR_COLORS[hash(resourceCode) % AVATAR_COLORS.length]
  const displayedBackgroundColor = muted ? '#B8BDC7' : backgroundColor
  const initials = getCommentaryInitials(author, fallback)

  return (
    <Box
      size={size}
      borderRadius={size / 2}
      center
      borderWidth={outlined ? 2 : 0}
      borderColor={outlined ? displayedBackgroundColor : undefined}
      backgroundColor={outlined ? 'transparent' : displayedBackgroundColor}
      opacity={muted ? 0.6 : 1}
    >
      <Text
        fontSize={size * (initials.length > 2 ? 0.31 : 0.39)}
        lineHeight={size * 0.48}
        color={outlined ? displayedBackgroundColor : '#FFFFFF'}
        style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }}
      >
        {initials}
      </Text>
    </Box>
  )
}

export default CommentaryAvatar
