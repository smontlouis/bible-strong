import Color from 'color'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import Avatar from 'react-native-boring-avatars'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'

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

const AvatarImage = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.Image>, keyof { size: number } | 'theme'> &
    Omit<{ size: number }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { size } = props
  const resolvedClassName = twMerge('bg-light-grey', className)
  return (
    <NativeUI.Image
      {...props}
      className={resolvedClassName}
      style={
        [{ width: size, height: size, borderRadius: size / 2 }, props.style] as UIComponentProps<
          typeof NativeUI.Image
        >['style']
      }
    />
  )
}

export default UserAvatar
