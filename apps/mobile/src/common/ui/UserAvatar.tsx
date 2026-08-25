import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import React from 'react'
import Avatar from 'react-native-boring-avatars'
import Color from 'color'

interface UserAvatarProps {
  size?: number
  photoURL?: string
  displayName?: string
  email?: string
}

const UserAvatar = ({ size = 60, photoURL, displayName, email }: UserAvatarProps) => {
  const theme = useTheme()

  // Create 5 shades of primary color using Color library
  const basePrimary = theme.colors.primary
  const colors = [
    Color(basePrimary).lighten(0.4).hex(),
    Color(basePrimary).lighten(0.2).hex(),
    Color(basePrimary).hex(),
    Color(basePrimary).darken(0.18).hex(),
    Color(basePrimary).darken(0.32).hex(),
  ]

  if (photoURL) {
    return <AvatarImage source={{ uri: photoURL }} size={size} />
  }

  return <Avatar size={size} name={displayName || email || 'user'} variant="beam" colors={colors} />
}

const AvatarImage = styled.Image<{ size: number }>(({ theme, size }) => ({
  width: size,
  height: size,
  borderRadius: size / 2,
  backgroundColor: theme.colors.lightGrey,
}))

export default UserAvatar
