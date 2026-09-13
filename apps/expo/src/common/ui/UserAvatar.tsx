import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import GeneratedUserAvatar from './GeneratedUserAvatar'

import type { Theme as AppTheme } from '~themes'

interface UserAvatarProps {
  size?: number
  photoURL?: string
  displayName?: string
  email?: string
}

const UserAvatar = ({ size = 60, photoURL, displayName, email }: UserAvatarProps) => {
  if (photoURL) {
    return <AvatarImage source={{ uri: photoURL }} size={size} />
  }

  return (
    <GeneratedUserAvatar
      size={size}
      name={displayName || email || 'user'}
      traits={{ shape: [0.11, 0.35, 0.54, 0.65, 0.888, 0.933], 'body.r': 0.999 }}
    />
  )
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
