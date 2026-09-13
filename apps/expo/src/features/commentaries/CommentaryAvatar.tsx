import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React from 'react'
import { Platform } from 'react-native'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { getCommentaryInitials, getCommentaryAvatarColor } from './commentaryAvatarIdentity'
export { getCommentaryInitials } from './commentaryAvatarIdentity'

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
  const stylingTheme = useStylingTheme()

  const backgroundColor = getCommentaryAvatarColor(resourceCode)
  const displayedBackgroundColor = muted ? '#B8BDC7' : backgroundColor
  const initials = getCommentaryInitials(author, fallback)

  return (
    <Box
      className="overflow-hidden border-continuous items-center justify-center"
      style={{
        borderRadius: size / 2,
        borderWidth: outlined ? 2 : 0,
        backgroundColor: resolveThemeColor(
          stylingTheme,
          outlined ? 'transparent' : displayedBackgroundColor
        ),
        borderColor: resolveThemeColor(
          stylingTheme,
          outlined ? displayedBackgroundColor : undefined
        ),
        opacity: muted ? 0.6 : 1,
        ...(size ? { width: size, height: size } : {}),
      }}
    >
      <Text
        style={[
          {
            fontSize: size * (initials.length > 2 ? 0.31 : 0.39) || 16,
            lineHeight: size * 0.48,
            color:
              resolveThemeColor(stylingTheme, outlined ? displayedBackgroundColor : '#FFFFFF') ||
              stylingTheme.colors.default,
          },
          { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
        ]}
      >
        {initials}
      </Text>
    </Box>
  )
}

export default CommentaryAvatar
